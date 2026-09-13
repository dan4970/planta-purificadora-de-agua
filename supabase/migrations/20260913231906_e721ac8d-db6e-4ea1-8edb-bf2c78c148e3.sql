-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','supervisor','tecnico');
CREATE TYPE public.criticality_level AS ENUM ('critico','importante','general');
CREATE TYPE public.wo_type AS ENUM ('correctivo','preventivo','predictivo');
CREATE TYPE public.wo_status AS ENUM ('abierta','en_proceso','espera_repuesto','cerrada','cancelada');
CREATE TYPE public.wo_priority AS ENUM ('baja','media','alta','urgente');
CREATE TYPE public.asset_status AS ENUM ('operativo','alarma','mantenimiento','detenido');
CREATE TYPE public.severity_level AS ENUM ('bueno','aceptable','alerta','peligro');
CREATE TYPE public.freq_type AS ENUM ('dias','horas');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','supervisor'))
$$;

CREATE POLICY "perfiles visibles para usuarios" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cada uno edita su perfil" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insertar propio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "roles visibles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- NEW USER HOOK
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'tecnico'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ASSETS
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  criticality public.criticality_level NOT NULL DEFAULT 'general',
  location TEXT,
  status public.asset_status NOT NULL DEFAULT 'operativo',
  service_hours NUMERIC NOT NULL DEFAULT 0,
  model TEXT,
  serial_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipos visibles" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff crea equipos" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff edita equipos" ON public.assets FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin borra equipos" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- WORK ORDERS
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number BIGINT GENERATED ALWAYS AS IDENTITY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  type public.wo_type NOT NULL DEFAULT 'correctivo',
  priority public.wo_priority NOT NULL DEFAULT 'media',
  status public.wo_status NOT NULL DEFAULT 'abierta',
  title TEXT NOT NULL,
  description TEXT,
  symptom TEXT,
  root_cause TEXT,
  work_done TEXT,
  assigned_to UUID,
  created_by UUID,
  downtime_hours NUMERIC NOT NULL DEFAULT 0,
  labor_hours NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ordenes visibles" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios crean ordenes" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff o asignado edita orden" ON public.work_orders FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) OR assigned_to = auth.uid());
CREATE POLICY "admin borra ordenes" ON public.work_orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.work_order_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_parts TO authenticated;
GRANT ALL ON public.work_order_parts TO service_role;
ALTER TABLE public.work_order_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repuestos visibles" ON public.work_order_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios gestionan repuestos" ON public.work_order_parts FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- PM PLANS
CREATE TABLE public.pm_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency_type public.freq_type NOT NULL DEFAULT 'dias',
  frequency_value INTEGER NOT NULL DEFAULT 30,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC NOT NULL DEFAULT 1,
  last_done_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_plans TO authenticated;
GRANT ALL ON public.pm_plans TO service_role;
ALTER TABLE public.pm_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planes visibles" ON public.pm_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff gestiona planes" ON public.pm_plans FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff edita planes" ON public.pm_plans FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin borra planes" ON public.pm_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pm_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pm_plan_id UUID NOT NULL REFERENCES public.pm_plans(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by UUID,
  notes TEXT,
  checklist_result JSONB NOT NULL DEFAULT '[]'::jsonb,
  hours_spent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_executions TO authenticated;
GRANT ALL ON public.pm_executions TO service_role;
ALTER TABLE public.pm_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ejecuciones visibles" ON public.pm_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios registran ejecuciones" ON public.pm_executions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff edita ejecuciones" ON public.pm_executions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.after_pm_execution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD;
BEGIN
  SELECT * INTO p FROM public.pm_plans WHERE id = NEW.pm_plan_id;
  IF p.id IS NOT NULL THEN
    UPDATE public.pm_plans
      SET last_done_at = NEW.executed_at,
          next_due_at = CASE WHEN p.frequency_type = 'dias'
            THEN NEW.executed_at + (p.frequency_value || ' days')::interval
            ELSE NEW.executed_at + (GREATEST(p.frequency_value / 24, 1) || ' days')::interval END
    WHERE id = p.id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_after_pm_execution AFTER INSERT ON public.pm_executions
FOR EACH ROW EXECUTE FUNCTION public.after_pm_execution();

-- MEASUREMENT POINTS
CREATE TABLE public.measurement_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position TEXT,
  direction TEXT,
  sensor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_points TO authenticated;
GRANT ALL ON public.measurement_points TO service_role;
ALTER TABLE public.measurement_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "puntos visibles" ON public.measurement_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff gestiona puntos" ON public.measurement_points FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.alarm_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_point_id UUID NOT NULL UNIQUE REFERENCES public.measurement_points(id) ON DELETE CASCADE,
  good_max NUMERIC NOT NULL DEFAULT 2.8,
  acceptable_max NUMERIC NOT NULL DEFAULT 4.5,
  alert_max NUMERIC NOT NULL DEFAULT 7.1,
  temperature_max NUMERIC NOT NULL DEFAULT 80,
  iso_class TEXT NOT NULL DEFAULT 'Clase II',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarm_thresholds TO authenticated;
GRANT ALL ON public.alarm_thresholds TO service_role;
ALTER TABLE public.alarm_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "limites visibles" ON public.alarm_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff gestiona limites" ON public.alarm_thresholds FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.vibration_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_point_id UUID NOT NULL REFERENCES public.measurement_points(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  velocity_rms NUMERIC NOT NULL,
  acceleration_rms NUMERIC,
  temperature_c NUMERIC,
  rpm NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual',
  severity public.severity_level NOT NULL DEFAULT 'bueno',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_readings_point_time ON public.vibration_readings (measurement_point_id, measured_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vibration_readings TO authenticated;
GRANT ALL ON public.vibration_readings TO service_role;
ALTER TABLE public.vibration_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecturas visibles" ON public.vibration_readings FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios registran lecturas" ON public.vibration_readings FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff edita lecturas" ON public.vibration_readings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin borra lecturas" ON public.vibration_readings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.classify_reading()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t RECORD; sev public.severity_level;
BEGIN
  SELECT * INTO t FROM public.alarm_thresholds WHERE measurement_point_id = NEW.measurement_point_id;
  IF t.id IS NULL THEN
    sev := CASE WHEN NEW.velocity_rms <= 2.8 THEN 'bueno' WHEN NEW.velocity_rms <= 4.5 THEN 'aceptable'
                WHEN NEW.velocity_rms <= 7.1 THEN 'alerta' ELSE 'peligro' END;
  ELSE
    sev := CASE WHEN NEW.velocity_rms <= t.good_max THEN 'bueno' WHEN NEW.velocity_rms <= t.acceptable_max THEN 'aceptable'
                WHEN NEW.velocity_rms <= t.alert_max THEN 'alerta' ELSE 'peligro' END;
    IF NEW.temperature_c IS NOT NULL AND NEW.temperature_c > t.temperature_max AND sev <> 'peligro' THEN
      sev := 'alerta';
    END IF;
  END IF;
  NEW.severity := sev;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_classify_reading BEFORE INSERT OR UPDATE ON public.vibration_readings
FOR EACH ROW EXECUTE FUNCTION public.classify_reading();

CREATE OR REPLACE FUNCTION public.reading_alarm_effect()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a_id UUID;
BEGIN
  SELECT asset_id INTO a_id FROM public.measurement_points WHERE id = NEW.measurement_point_id;
  IF NEW.severity IN ('alerta','peligro') AND a_id IS NOT NULL THEN
    UPDATE public.assets SET status = 'alarma' WHERE id = a_id AND status = 'operativo';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_reading_alarm AFTER INSERT ON public.vibration_readings
FOR EACH ROW EXECUTE FUNCTION public.reading_alarm_effect();

CREATE TABLE public.diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  measurement_point_id UUID REFERENCES public.measurement_points(id) ON DELETE SET NULL,
  fault_type TEXT NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'alerta',
  findings TEXT,
  recommendation TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnoses TO authenticated;
GRANT ALL ON public.diagnoses TO service_role;
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagnosticos visibles" ON public.diagnoses FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios crean diagnosticos" ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff edita diagnosticos" ON public.diagnoses FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.ingest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ingest_tokens TO authenticated;
GRANT ALL ON public.ingest_tokens TO service_role;
ALTER TABLE public.ingest_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ve claves" ON public.ingest_tokens FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- SEED: EQUIPOS
INSERT INTO public.assets (code, name, area, criticality, location, service_hours) VALUES
('TR-001','Bomba de alimentación de agua cruda','Tratamiento','critico','Cisterna de agua cruda', 18500),
('TR-002','Filtro de lecho profundo (multimedia)','Tratamiento','importante','Línea de filtración', 21000),
('TR-003','Filtro de carbón activado','Tratamiento','importante','Línea de filtración', 20800),
('TR-004','Suavizador de agua (ablandador)','Tratamiento','importante','Línea de filtración', 19700),
('TR-005','Dosificadora de químicos (anticrustante)','Tratamiento','importante','Sala de químicos', 12300),
('TR-006','Filtro pulidor (cartucho de seguridad)','Tratamiento','general','Previo a ósmosis', 9800),
('TR-007','Bomba de alta presión','Tratamiento','critico','Skid de ósmosis inversa', 16400),
('TR-008','Sistema de Ósmosis Inversa','Tratamiento','critico','Skid de ósmosis inversa', 16400),
('TR-009','Sistema de desinfección ultravioleta (UV)','Tratamiento','importante','Post ósmosis', 14200),
('TR-010','Generador de ozono (ozonizador)','Tratamiento','importante','Sala de ozono', 13100),
('TR-011','Tanques de almacenamiento de agua purificada','Tratamiento','general','Área de tanques', 0),
('TR-012','Bombas impulsoras / hidroneumáticas','Tratamiento','critico','Sala de bombeo', 22400),
('EB-001','Cintas transportadoras de entrada','Embotellado','importante','Línea de bidones - entrada', 15600),
('EB-002','Cabina de lavador de bidones automático','Embotellado','critico','Línea de bidones', 17300),
('EB-003','Cabina de enjuague final','Embotellado','importante','Línea de bidones', 16900),
('EB-004','Cabina de llenado de bidones automático','Embotellado','critico','Línea de bidones', 17800),
('EB-005','Colocador y sellador de tapas automático','Embotellado','critico','Línea de bidones', 17100),
('EB-006','Codificadora / impresora de lote','Embotellado','importante','Línea de bidones', 11200),
('EB-007','Lámpara de inspección visual','Embotellado','general','Línea de bidones', 9400),
('EB-008','Cintas transportadoras de salida','Embotellado','importante','Línea de bidones - salida', 15400),
('EB-009','Máquina enfardadora / maletizadora','Embotellado','importante','Área de empaque', 10800),
('EB-010','Paletizadora / sistema de estibado','Embotellado','importante','Área de empaque', 10200);

-- SEED: PUNTOS DE MEDICIÓN EN EQUIPOS CRÍTICOS
INSERT INTO public.measurement_points (asset_id, code, name, position, direction, sensor_id)
SELECT a.id, a.code || '-' || p.suffix, p.pname, p.pos, p.dir, 'SNS-' || a.code || '-' || p.suffix
FROM public.assets a
CROSS JOIN (VALUES
  ('MH','Motor lado libre - horizontal','Motor lado libre','Horizontal'),
  ('MV','Motor lado acople - vertical','Motor lado acople','Vertical'),
  ('BH','Equipo lado acople - horizontal','Equipo lado acople','Horizontal'),
  ('BA','Equipo lado libre - axial','Equipo lado libre','Axial')
) AS p(suffix, pname, pos, dir)
WHERE a.criticality = 'critico';

INSERT INTO public.alarm_thresholds (measurement_point_id, good_max, acceptable_max, alert_max, temperature_max, iso_class)
SELECT id, 2.8, 4.5, 7.1, 80, 'Clase II' FROM public.measurement_points;

-- SEED: PLANES PREVENTIVOS
INSERT INTO public.pm_plans (asset_id, name, description, frequency_type, frequency_value, checklist, estimated_hours, last_done_at, next_due_at)
SELECT a.id,
  'Rutina preventiva - ' || a.name,
  'Inspección general, limpieza, lubricación y verificación de parámetros de operación.',
  'dias',
  CASE a.criticality WHEN 'critico' THEN 30 WHEN 'importante' THEN 60 ELSE 90 END,
  '["Inspección visual general","Limpieza del equipo","Lubricación de puntos","Revisión de conexiones eléctricas","Verificación de presión / caudal","Registro de parámetros"]'::jsonb,
  2,
  now() - ((CASE a.criticality WHEN 'critico' THEN 25 WHEN 'importante' THEN 55 ELSE 80 END) || ' days')::interval,
  now() + ((CASE a.criticality WHEN 'critico' THEN 5 WHEN 'importante' THEN 5 ELSE 10 END) || ' days')::interval
FROM public.assets a;

UPDATE public.pm_plans SET next_due_at = now() - interval '4 days'
WHERE asset_id IN (SELECT id FROM public.assets WHERE code IN ('TR-001','EB-002','TR-012'));

-- SEED: LECTURAS DE VIBRACIÓN (90 días, cada 3 días)
INSERT INTO public.vibration_readings (measurement_point_id, measured_at, velocity_rms, acceleration_rms, temperature_c, rpm, source)
SELECT mp.id,
  now() - (d || ' days')::interval,
  ROUND((base.b + (29 - d/3) * base.slope + (random() * 0.35))::numeric, 2),
  ROUND((1.5 + random() * 1.8)::numeric, 2),
  ROUND((48 + random() * 14 + (29 - d/3) * 0.2)::numeric, 1),
  CASE WHEN a.area = 'Tratamiento' THEN 3550 ELSE 1450 END,
  'sensor'
FROM public.measurement_points mp
JOIN public.assets a ON a.id = mp.asset_id
CROSS JOIN generate_series(0, 87, 3) AS d
CROSS JOIN LATERAL (
  SELECT CASE WHEN a.code IN ('TR-001','TR-012') THEN 2.6 ELSE 1.6 END AS b,
         CASE WHEN a.code = 'TR-001' THEN 0.13 WHEN a.code = 'TR-012' THEN 0.07 ELSE 0.02 END AS slope
) AS base;

-- SEED: ÓRDENES DE TRABAJO
INSERT INTO public.work_orders (asset_id, type, priority, status, title, description, symptom, downtime_hours, labor_hours, cost, opened_at, closed_at, due_date)
SELECT a.id, w.tp::public.wo_type, w.pr::public.wo_priority, w.st::public.wo_status, w.ti, w.de, w.sy, w.dt, w.lh, w.co,
  now() - (w.days || ' days')::interval,
  CASE WHEN w.st = 'cerrada' THEN now() - ((w.days - 1) || ' days')::interval ELSE NULL END,
  (now() + interval '5 days')::date
FROM (VALUES
  ('TR-001','correctivo','urgente','en_proceso','Vibración elevada en bomba de agua cruda','Tendencia de vibración en zona de alerta según ISO 10816.','Ruido y vibración perceptible en lado acople',4,3,18500,3),
  ('TR-007','preventivo','alta','abierta','Cambio de aceite y revisión de sellos','Rutina de 500 horas de la bomba de alta presión.','',0,2,9200,1),
  ('EB-002','correctivo','alta','espera_repuesto','Fuga en boquillas de lavado','Se detectó fuga en el manifold de boquillas.','Presión de lavado por debajo de lo normal',6,4,14300,6),
  ('EB-004','correctivo','media','cerrada','Ajuste de válvula de llenado','Reemplazo de o-ring y calibración de dosis.','Sobrellenado intermitente de bidones',2,2,5600,12),
  ('TR-008','preventivo','media','abierta','Limpieza química de membranas (CIP)','Limpieza programada por caída de rechazo de sales.','',0,5,22000,2),
  ('TR-012','predictivo','alta','abierta','Análisis de vibración por desalineación','Diagnóstico predictivo con tendencia ascendente.','Vibración axial creciente',0,2,0,4),
  ('EB-005','correctivo','baja','cerrada','Cambio de correa del sellador','Correa con desgaste normal por horas de uso.','Deslizamiento del cabezal',1,1,3200,20),
  ('TR-010','preventivo','media','en_proceso','Mantenimiento del generador de ozono','Limpieza de celdas y verificación de concentración.','',0,3,7400,2)
) AS w(code, tp, pr, st, ti, de, sy, dt, lh, co, days)
JOIN public.assets a ON a.code = w.code;

UPDATE public.assets SET status = 'alarma' WHERE code IN ('TR-001','TR-012');
UPDATE public.assets SET status = 'mantenimiento' WHERE code = 'EB-002';

-- SEED: DIAGNÓSTICOS
INSERT INTO public.diagnoses (asset_id, measurement_point_id, fault_type, severity, findings, recommendation)
SELECT a.id, mp.id, 'Desalineación', 'alerta',
  'Armónicos 1x y 2x con componente axial significativa en el lado acople.',
  'Programar alineación láser del conjunto motor-bomba en la próxima parada.'
FROM public.assets a
JOIN public.measurement_points mp ON mp.asset_id = a.id AND mp.code = a.code || '-BA'
WHERE a.code = 'TR-001';