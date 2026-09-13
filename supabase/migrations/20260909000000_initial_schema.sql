-- ====================================================================
-- ISGG ABSENCES - SCHEMA POSTGRESQL OFFICIEL & MIGRATION SUPABASE
-- Institut Supérieur de Génie Civil et de Gestion
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('SURVEILLANT', 'ADMIN');

-- 3. USERS / PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    title TEXT DEFAULT 'Surveillant',
    role user_role DEFAULT 'SURVEILLANT',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SCHOOL YEARS (Années Académiques)
CREATE TABLE IF NOT EXISTS public.school_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, -- e.g. '2025-2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROGRAMS (Filières ISGG)
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE, -- e.g. 'GI', 'GC', 'GT', 'GP', 'PGMP'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LEVELS (Niveaux / Années d'études)
CREATE TABLE IF NOT EXISTS public.levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE, -- e.g. 'L1', 'L2', 'L3', 'M1', 'M2'
    name VARCHAR(100) NOT NULL,
    level_order INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SUBJECTS (Matières)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL, -- e.g. 'BD201', 'BA301'
    name VARCHAR(255) NOT NULL,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
    teacher_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(code, program_id, level_id)
);

-- 8. STUDENTS (Étudiants)
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    matricule VARCHAR(50) NOT NULL UNIQUE, -- e.g. 'ISGG-2024-042'
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
    email VARCHAR(255),
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ABSENCES
CREATE TABLE IF NOT EXISTS public.absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE RESTRICT,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    absence_date DATE NOT NULL DEFAULT CURRENT_DATE,
    absence_time TIME NOT NULL DEFAULT CURRENT_TIME,
    justified BOOLEAN DEFAULT FALSE,
    justification_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- INDEXES DE HAUTE PERFORMANCE POUR LA RECHERCHE INSTANTANÉE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_students_program_level ON public.students(program_id, level_id);
CREATE INDEX IF NOT EXISTS idx_students_matricule ON public.students(matricule);
CREATE INDEX IF NOT EXISTS idx_students_names ON public.students(lower(last_name), lower(first_name));
CREATE INDEX IF NOT EXISTS idx_absences_student ON public.absences(student_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON public.absences(absence_date);
CREATE INDEX IF NOT EXISTS idx_absences_subject ON public.absences(subject_id);
CREATE INDEX IF NOT EXISTS idx_subjects_prog_level ON public.subjects(program_id, level_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée pour tout personnel connecté
CREATE POLICY "Lecture autorisee pour personnel" ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture autorisee pour levels" ON public.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture autorisee pour subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture autorisee pour students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture autorisee pour absences" ON public.absences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture autorisee pour school_years" ON public.school_years FOR SELECT TO authenticated USING (true);

-- Écriture d'absences : Surveillants et Admins
CREATE POLICY "Saisie absences surveillants et admins" ON public.absences
FOR INSERT TO authenticated
WITH CHECK (true);

-- Modification/Suppression : Admins uniquement
CREATE POLICY "Admin full access absences" ON public.absences
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
    )
);
