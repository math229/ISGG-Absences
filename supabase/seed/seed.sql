-- ====================================================================
-- SEED DATA POUR ISGG ABSENCES (POSTGRESQL / SUPABASE)
-- ====================================================================

-- 1. Année académique
INSERT INTO public.school_years (id, name, start_date, end_date, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', '2025-2026', '2025-09-15', '2026-06-30', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Filières
INSERT INTO public.programs (id, code, name, description) VALUES
('22222222-2222-2222-2222-222222222221', 'GI', 'Génie Informatique', 'Systèmes d''information, réseaux et développement logiciel'),
('22222222-2222-2222-2222-222222222222', 'GC', 'Génie Civil / BTP', 'Calcul des structures, béton armé et conduite de travaux'),
('22222222-2222-2222-2222-222222222223', 'GT', 'Géomètre Topographe', 'Topométrie générale, cartographie numérique et foncier'),
('22222222-2222-2222-2222-222222222224', 'GP', 'Gestion des Projets', 'Planification, budgétisation et gouvernance opérationnelle'),
('22222222-2222-2222-2222-222222222225', 'PGMP', 'Passation et Gestion des Marchés Publics', 'Réglementation et audits des marchés')
ON CONFLICT (code) DO NOTHING;

-- 3. Niveaux
INSERT INTO public.levels (id, code, name, level_order) VALUES
('33333333-3333-3333-3333-333333333331', 'L1', '1ère année (Licence 1)', 1),
('33333333-3333-3333-3333-333333333332', 'L2', '2ème année (Licence 2)', 2),
('33333333-3333-3333-3333-333333333333', 'L3', '3ème année (Licence 3)', 3),
('33333333-3333-3333-3333-333333333334', 'M1', 'Master 1', 4),
('33333333-3333-3333-3333-333333333335', 'M2', 'Master 2', 5)
ON CONFLICT (code) DO NOTHING;

-- 4. Matières
INSERT INTO public.subjects (id, code, name, program_id, level_id, teacher_name) VALUES
('44444444-4444-4444-4444-444444444441', 'BD201', 'Base de données', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333332', 'Dr. Agbossou'),
('44444444-4444-4444-4444-444444444442', 'ALGO202', 'Algorithmique & Structures de données', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333332', 'M. Sossou'),
('44444444-4444-4444-4444-444444444443', 'BA301', 'Béton Armé', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Ing. Kpadonou')
ON CONFLICT DO NOTHING;

-- 5. Étudiant principal du scénario de test : APITHY Mathieu
INSERT INTO public.students (id, matricule, first_name, last_name, program_id, level_id, email, phone)
VALUES ('55555555-5555-5555-5555-555555555551', 'ISGG-2024-042', 'Mathieu', 'APITHY', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333332', 'mathieu.apithy@etud.isgg-edu.com', '+229 97 12 34 56')
ON CONFLICT (matricule) DO NOTHING;
