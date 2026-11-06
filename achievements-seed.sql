--
-- PostgreSQL database dump
--

\restrict 7A633eObgxOqMHHhBtXAD7pNi171oobskTdUtAfo52I50Fb2fha4KQvnkvcSnZ8

-- Dumped from database version 17.11 (9045acd)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: achievements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.achievements (id, title, description, category) VALUES ('streak_master', 'Streak Master', 'Mantenha sequências de consistência', 'streak') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('deep_focus', 'Deep Focus', 'Complete sessões longas de foco', 'focus') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('early_riser', 'Early Riser', 'Faça check-in antes das 7h', 'checkin') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('sleep_champion', 'Sleep Champion', 'Durma 7 horas ou mais', 'sleep') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('consistency_king', 'Consistency King', 'Semanas perfeitas de check-in', 'checkin') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('xp_olympian', 'XP Olympian', 'Acumule minutos de foco ao longo da vida', 'focus') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('social_spark', 'Social Spark', 'Faça amigos e entre em grupos', 'social') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('rarest_aura', 'Rarest Aura', 'Termine no topo da liga Núcleo', 'league') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('squad_leader', 'Squad Leader', 'Tenha o maior grupo onde você é dono', 'social') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('focus_companion', 'Companheiro de Foco', 'Conclua sessões focando com outras pessoas', 'focus') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('flow_state', 'Estado de Fluxo', 'Complete uma sessão de foco ininterrupta', 'focus') ON CONFLICT DO NOTHING;
INSERT INTO public.achievements (id, title, description, category) VALUES ('aura_collector', 'Colecionador de Auras', 'Colecione uma porcentagem das auras disponíveis', 'aura') ON CONFLICT DO NOTHING;


--
-- PostgreSQL database dump complete
--

\unrestrict 7A633eObgxOqMHHhBtXAD7pNi171oobskTdUtAfo52I50Fb2fha4KQvnkvcSnZ8

