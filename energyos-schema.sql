--
-- PostgreSQL database dump
--

\restrict cdhQLrq128XoCsuVF3HUbH4iMUM6pqflzjKBZTda1FiKjQNCEQU6NmS55nvab3R

-- Dumped from database version 17.11 (11592b3)
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
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA neon_auth;


--
-- Name: BriefingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BriefingStatus" AS ENUM (
    'PENDING',
    'CONTACTED',
    'IN_NEGOTIATION',
    'APPROVED',
    'REJECTED',
    'ARCHIVED'
);


--
-- Name: CouponType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CouponType" AS ENUM (
    'PERCENTAGE',
    'FIXED',
    'FREE_SHIPPING'
);


--
-- Name: FeedbackPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FeedbackPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH'
);


--
-- Name: FeedbackService; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FeedbackService" AS ENUM (
    'landing_page',
    'site',
    'saas',
    'pacote_completo',
    'outro'
);


--
-- Name: FeedbackSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FeedbackSource" AS ENUM (
    'site',
    'produto',
    'pedido',
    'suporte',
    'outro'
);


--
-- Name: FeedbackStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FeedbackStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ARCHIVED'
);


--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'SCHEDULED'
);


--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);


--
-- Name: ProductStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProductStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'OUT_OF_STOCK'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'CUSTOMER',
    'ADMIN'
);


--
-- Name: league_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.league_tier AS ENUM (
    'BRONZE',
    'PRATA',
    'OURO',
    'DIAMANTE',
    'LENDAS'
);


--
-- Name: participant_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.participant_session_status AS ENUM (
    'waiting',
    'focusing',
    'completed',
    'left'
);


--
-- Name: quest_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quest_type AS ENUM (
    'SESSIONS_COUNT',
    'TOTAL_MINUTES',
    'ROOM_SESSION'
);


--
-- Name: room_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.room_status AS ENUM (
    'waiting',
    'active',
    'completed',
    'expired',
    'paused',
    'restarting'
);


--
-- Name: streak_day_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.streak_day_status AS ENUM (
    'success',
    'protected',
    'lost'
);


--
-- Name: prevent_focus_companion_regression(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_focus_companion_regression() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.achievement_id in ('focus_companion', 'deep_focus', 'flow_state')
     and tg_op = 'UPDATE'
     and new.current_value < old.current_value then
    new.current_value := old.current_value;
    new.unlocked_tier := greatest(new.unlocked_tier, old.unlocked_tier);
    new.unlocked_at := coalesce(old.unlocked_at, new.unlocked_at);
  end if;
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone
);


--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL,
    plugin_configs jsonb,
    webhook_config jsonb
);


--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: -
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


--
-- Name: Address; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Address" (
    id text NOT NULL,
    "userId" text NOT NULL,
    label text,
    street text NOT NULL,
    number text NOT NULL,
    complement text,
    neighborhood text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL
);


--
-- Name: Banner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Banner" (
    id text NOT NULL,
    title text NOT NULL,
    subtitle text,
    "imageUrl" text NOT NULL,
    "linkUrl" text,
    "position" integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "linkLabel" text,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Cart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Cart" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    variants jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Coupon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Coupon" (
    id text NOT NULL,
    code text NOT NULL,
    discount numeric(10,2) NOT NULL,
    "minAmount" numeric(10,2),
    "maxUses" integer DEFAULT 0 NOT NULL,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    "maxDiscount" numeric(10,2),
    name text,
    "startsAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "usagePerUser" integer,
    type public."CouponType" DEFAULT 'PERCENTAGE'::public."CouponType" NOT NULL
);


--
-- Name: CouponUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CouponUsage" (
    id text NOT NULL,
    "couponId" text NOT NULL,
    "userId" text,
    "orderId" text,
    "usedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Favorite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Favorite" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "userId" text,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    total numeric(10,2) NOT NULL,
    "paymentMethod" text NOT NULL,
    "paymentId" text,
    phone text NOT NULL,
    address jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "couponCode" text,
    "couponDiscount" numeric(10,2)
);


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrderItem" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    variants jsonb
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "orderId" text,
    "userId" text,
    provider text DEFAULT 'mercadopago'::text NOT NULL,
    method text,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    amount numeric(10,2) NOT NULL,
    "transactionId" text,
    "rawResponse" jsonb,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    "oldPrice" numeric(10,2),
    stock integer DEFAULT 0 NOT NULL,
    images text[],
    "categoryId" text NOT NULL,
    status public."ProductStatus" DEFAULT 'ACTIVE'::public."ProductStatus" NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    variants jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    short_description text,
    sku text
);


--
-- Name: Review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Review" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    rating integer NOT NULL,
    comment text,
    "verifiedPurchase" boolean DEFAULT false NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    images text[] DEFAULT ARRAY[]::text[],
    video_url text
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    password text,
    image text,
    role public."Role" DEFAULT 'CUSTOMER'::public."Role" NOT NULL,
    phone text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    cpf text,
    cart jsonb,
    deleted_at timestamp(3) without time zone,
    two_factor_activated_at timestamp(3) without time zone,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_recovery_codes jsonb,
    two_factor_secret text
);


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: Wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Wishlist" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: achievement_progress_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_progress_events (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    achievement_id text NOT NULL,
    source_id bigint NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: achievement_progress_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.achievement_progress_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: achievement_progress_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.achievement_progress_events_id_seq OWNED BY public.achievement_progress_events.id;


--
-- Name: achievement_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_rewards (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    achievement_id text NOT NULL,
    tier integer NOT NULL,
    coins_awarded integer DEFAULT 0 NOT NULL,
    xp_awarded integer DEFAULT 0 NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: achievement_rewards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.achievement_rewards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: achievement_rewards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.achievement_rewards_id_seq OWNED BY public.achievement_rewards.id;


--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL
);


--
-- Name: active_xp_boost; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_xp_boost (
    profile_id text NOT NULL,
    multiplier integer DEFAULT 2 NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: avatar_decorations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avatar_decorations (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    price integer NOT NULL,
    rarity text DEFAULT 'common'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT avatar_decorations_rarity_check CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text])))
);


--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_connections (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expires_at timestamp with time zone NOT NULL,
    calendar_id text,
    sync_token text,
    is_active boolean DEFAULT true NOT NULL,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT calendar_connections_provider_check CHECK ((provider = ANY (ARRAY['google'::text, 'microsoft'::text, 'apple'::text])))
);


--
-- Name: calendar_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_connections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_connections_id_seq OWNED BY public.calendar_connections.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    user_id text,
    name text NOT NULL,
    color text NOT NULL,
    icon text,
    is_custom boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: daily_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_checkins (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    checkin_date date NOT NULL,
    sleep_hours numeric(4,2),
    study_minutes integer,
    training_minutes integer,
    energy_score smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_checkins_energy_score_check CHECK (((energy_score >= 1) AND (energy_score <= 5)))
);


--
-- Name: daily_checkins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_checkins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_checkins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_checkins_id_seq OWNED BY public.daily_checkins.id;


--
-- Name: daily_habit_bonus_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_habit_bonus_log (
    profile_id text NOT NULL,
    bonus_date date NOT NULL,
    coins_awarded integer NOT NULL
);


--
-- Name: daily_mission_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_mission_claims (
    id bigint NOT NULL,
    user_id text NOT NULL,
    mission_id bigint NOT NULL,
    date date NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_mission_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_mission_claims_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_mission_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_mission_claims_id_seq OWNED BY public.daily_mission_claims.id;


--
-- Name: daily_quests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_quests (
    id bigint NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type public.quest_type NOT NULL,
    target_value integer NOT NULL,
    coin_reward integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metric text
);


--
-- Name: daily_quests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_quests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_quests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_quests_id_seq OWNED BY public.daily_quests.id;


--
-- Name: daily_task_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_task_log (
    task_id bigint NOT NULL,
    log_date date NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    progress_value numeric,
    completion_count integer DEFAULT 0 NOT NULL,
    rewards_claimed boolean DEFAULT false NOT NULL
);


--
-- Name: daily_task_pool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_task_pool (
    id bigint NOT NULL,
    title text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_task_pool_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_task_pool_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_task_pool_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_task_pool_id_seq OWNED BY public.daily_task_pool.id;


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direct_messages (
    id bigint NOT NULL,
    sender_id text NOT NULL,
    recipient_id text NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reply_to_id bigint,
    edited_at timestamp with time zone,
    message_type text DEFAULT 'TEXT'::text NOT NULL,
    media_url text,
    media_duration_seconds integer,
    media_file_name text,
    media_mime_type text,
    media_size_bytes bigint,
    CONSTRAINT direct_messages_check CHECK ((sender_id <> recipient_id))
);


--
-- Name: direct_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.direct_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: direct_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.direct_messages_id_seq OWNED BY public.direct_messages.id;


--
-- Name: dm_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dm_reads (
    profile_id text NOT NULL,
    other_id text NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: external_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_events (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    connection_id bigint NOT NULL,
    external_id text NOT NULL,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    all_day boolean DEFAULT false NOT NULL,
    location text,
    recurrence text,
    last_modified timestamp with time zone,
    is_readonly boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: external_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_events_id_seq OWNED BY public.external_events.id;


--
-- Name: feedback_helpful; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_helpful (
    id uuid NOT NULL,
    feedback_id uuid NOT NULL,
    fingerprint character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedbacks (
    id uuid NOT NULL,
    author_name character varying(100) NOT NULL,
    author_email character varying(255) NOT NULL,
    author_avatar_url text,
    author_company character varying(100),
    author_role character varying(100),
    author_linkedin_url text,
    service_type public."FeedbackService" NOT NULL,
    rating integer NOT NULL,
    title character varying(150) NOT NULL,
    body text NOT NULL,
    result_metric character varying(200),
    project_url text,
    video_url text,
    is_verified boolean DEFAULT false NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    is_approved boolean DEFAULT false NOT NULL,
    helpful_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    is_featured_services boolean DEFAULT false NOT NULL,
    featured_services_order integer DEFAULT 0 NOT NULL,
    user_id text,
    phone character varying(40),
    status public."FeedbackStatus" DEFAULT 'PENDING'::public."FeedbackStatus" NOT NULL,
    priority public."FeedbackPriority" DEFAULT 'NORMAL'::public."FeedbackPriority" NOT NULL,
    source public."FeedbackSource" DEFAULT 'site'::public."FeedbackSource" NOT NULL,
    product_id text,
    order_id text,
    images text[] DEFAULT ARRAY[]::text[],
    CONSTRAINT feedbacks_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: focus_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.focus_rooms (
    id bigint NOT NULL,
    code character varying(6) NOT NULL,
    host_profile_id text NOT NULL,
    status public.room_status DEFAULT 'waiting'::public.room_status NOT NULL,
    duration_minutes integer DEFAULT 25 NOT NULL,
    energy_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    elapsed_seconds integer DEFAULT 0 NOT NULL,
    last_resumed_at timestamp with time zone,
    ends_at timestamp with time zone,
    paused_at timestamp with time zone,
    remaining_seconds integer DEFAULT 0 NOT NULL
);


--
-- Name: focus_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.focus_rooms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: focus_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.focus_rooms_id_seq OWNED BY public.focus_rooms.id;


--
-- Name: focus_session_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.focus_session_events (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    session_id bigint NOT NULL,
    room_id bigint,
    participant_count integer DEFAULT 1 NOT NULL,
    duration_minutes integer NOT NULL,
    paused_count integer,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: focus_session_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.focus_session_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: focus_session_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.focus_session_events_id_seq OWNED BY public.focus_session_events.id;


--
-- Name: focus_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.focus_sessions (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    duration_minutes integer DEFAULT 0 NOT NULL,
    target_duration_minutes integer DEFAULT 25 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    task_id bigint,
    xp_earned integer DEFAULT 0 NOT NULL,
    energy_type text,
    room_id bigint,
    paused_count integer
);


--
-- Name: focus_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.focus_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: focus_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.focus_sessions_id_seq OWNED BY public.focus_sessions.id;


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id bigint NOT NULL,
    requester_id text NOT NULL,
    addressee_id text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT friendships_check CHECK ((requester_id <> addressee_id)),
    CONSTRAINT friendships_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])))
);


--
-- Name: friendships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.friendships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: friendships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.friendships_id_seq OWNED BY public.friendships.id;


--
-- Name: garden_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.garden_entries (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    session_id bigint,
    energy_type text NOT NULL,
    duration_minutes numeric(8,2) DEFAULT 0 NOT NULL,
    reward integer DEFAULT 1 NOT NULL,
    planted_at timestamp with time zone DEFAULT now() NOT NULL,
    legacy_key text,
    growth_stage text DEFAULT 'sprout'::text NOT NULL,
    status text DEFAULT 'growing'::text NOT NULL,
    CONSTRAINT garden_entries_growth_stage_check CHECK ((growth_stage = ANY (ARRAY['sprout'::text, 'young'::text, 'mature'::text]))),
    CONSTRAINT garden_entries_status_check CHECK ((status = ANY (ARRAY['growing'::text, 'alive'::text, 'withered'::text])))
);


--
-- Name: garden_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.garden_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: garden_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.garden_entries_id_seq OWNED BY public.garden_entries.id;


--
-- Name: goal_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goal_logs (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    goal_id bigint NOT NULL,
    log_date date NOT NULL,
    amount numeric(8,2) DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goal_logs_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: goal_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goal_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goal_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goal_logs_id_seq OWNED BY public.goal_logs.id;


--
-- Name: goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goals (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    title text NOT NULL,
    target_value numeric(8,2) NOT NULL,
    current_value numeric(8,2) DEFAULT 0 NOT NULL,
    frequency text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category_id bigint NOT NULL,
    unit text,
    deadline date,
    completed_at timestamp with time zone,
    progress_reset_at timestamp with time zone,
    CONSTRAINT goals_frequency_check CHECK ((frequency = 'unique'::text))
);


--
-- Name: goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.goals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.goals_id_seq OWNED BY public.goals.id;


--
-- Name: group_achievement_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_achievement_claims (
    id bigint NOT NULL,
    achievement_id text NOT NULL,
    group_id bigint NOT NULL,
    profile_id text NOT NULL,
    coins_awarded integer DEFAULT 0 NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_achievement_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_achievement_claims_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_achievement_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_achievement_claims_id_seq OWNED BY public.group_achievement_claims.id;


--
-- Name: group_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_achievements (
    id text NOT NULL,
    group_id bigint NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_achievements_id_check CHECK ((id = ANY (ARRAY['sincronia'::text, 'esquadrao_completo'::text, 'maratona_coletiva'::text, 'consistencia_de_equipe'::text])))
);


--
-- Name: group_activity_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_activity_milestones (
    id integer NOT NULL,
    group_id integer NOT NULL,
    threshold_minutes integer NOT NULL,
    coins_per_member integer NOT NULL,
    badge_key text,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_activity_milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_activity_milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_activity_milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_activity_milestones_id_seq OWNED BY public.group_activity_milestones.id;


--
-- Name: group_focus_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_focus_contributions (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    profile_id text NOT NULL,
    focus_session_id bigint NOT NULL,
    minutes integer NOT NULL,
    contributed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_focus_contributions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_focus_contributions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_focus_contributions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_focus_contributions_id_seq OWNED BY public.group_focus_contributions.id;


--
-- Name: group_focus_room_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_focus_room_presence (
    group_id bigint NOT NULL,
    room_id bigint NOT NULL,
    profile_id text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_heartbeat timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_invites (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    invited_profile_id text NOT NULL,
    invited_by_profile_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT group_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: group_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_invites_id_seq OWNED BY public.group_invites.id;


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    group_id bigint NOT NULL,
    profile_id text NOT NULL,
    role text DEFAULT 'MEMBER'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    is_muted boolean DEFAULT false NOT NULL,
    is_banned boolean DEFAULT false NOT NULL,
    CONSTRAINT group_members_role_check CHECK ((role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text, 'MEMBER'::text])))
);


--
-- Name: group_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_messages (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    sender_id text NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_type text DEFAULT 'TEXT'::text NOT NULL,
    media_url text,
    media_duration_seconds integer,
    reply_to_id bigint,
    edited_at timestamp with time zone,
    media_file_name text,
    media_mime_type text,
    media_size_bytes bigint
);


--
-- Name: group_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_messages_id_seq OWNED BY public.group_messages.id;


--
-- Name: group_milestone_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_milestone_claims (
    id integer NOT NULL,
    group_id integer NOT NULL,
    profile_id text NOT NULL,
    threshold_minutes integer NOT NULL,
    coins_awarded integer NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_milestone_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_milestone_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_milestone_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_milestone_claims_id_seq OWNED BY public.group_milestone_claims.id;


--
-- Name: group_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_reads (
    profile_id text NOT NULL,
    group_id bigint NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_weekly_quest_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_weekly_quest_claims (
    id integer NOT NULL,
    group_id integer NOT NULL,
    profile_id text NOT NULL,
    week_start date NOT NULL,
    coins_awarded integer NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_weekly_quest_claims_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_weekly_quest_claims_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_weekly_quest_claims_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_weekly_quest_claims_id_seq OWNED BY public.group_weekly_quest_claims.id;


--
-- Name: group_weekly_quests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_weekly_quests (
    id integer NOT NULL,
    group_id integer NOT NULL,
    week_start date NOT NULL,
    target_minutes integer DEFAULT 500 NOT NULL,
    coins_per_member integer DEFAULT 50 NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: group_weekly_quests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_weekly_quests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_weekly_quests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_weekly_quests_id_seq OWNED BY public.group_weekly_quests.id;


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id bigint NOT NULL,
    name text NOT NULL,
    avatar_emoji text DEFAULT '⚡'::text NOT NULL,
    avatar_url text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    is_public boolean DEFAULT false NOT NULL
);


--
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- Name: habit_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habit_completions (
    habit_id bigint NOT NULL,
    profile_id text NOT NULL,
    completed_date date NOT NULL
);


--
-- Name: habits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habits (
    id bigint NOT NULL,
    goal_id bigint NOT NULL,
    title text NOT NULL,
    frequency text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT habits_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text])))
);


--
-- Name: habits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.habits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: habits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.habits_id_seq OWNED BY public.habits.id;


--
-- Name: insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insights (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    week_start date NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT insights_kind_check CHECK ((kind = ANY (ARRAY['sleep'::text, 'study'::text, 'training'::text, 'energy'::text, 'tasks'::text])))
);


--
-- Name: insights_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.insights_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: insights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.insights_id_seq OWNED BY public.insights.id;


--
-- Name: kanban_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kanban_labels (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kanban_labels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kanban_labels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kanban_labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kanban_labels_id_seq OWNED BY public.kanban_labels.id;


--
-- Name: kanban_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kanban_tasks (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo'::text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    labels text[] DEFAULT '{}'::text[],
    due_date date,
    priority text DEFAULT 'medium'::text,
    assignee_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category_id bigint NOT NULL,
    CONSTRAINT kanban_tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT kanban_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'doing'::text, 'done'::text])))
);


--
-- Name: kanban_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kanban_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kanban_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kanban_tasks_id_seq OWNED BY public.kanban_tasks.id;


--
-- Name: league_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_entries (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    week_start date NOT NULL,
    tier text NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    rank integer,
    CONSTRAINT league_entries_tier_check CHECK ((tier = ANY (ARRAY['faisca'::text, 'chama'::text, 'aura'::text, 'nucleo'::text])))
);


--
-- Name: league_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.league_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: league_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.league_entries_id_seq OWNED BY public.league_entries.id;


--
-- Name: league_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_group_members (
    id bigint NOT NULL,
    league_group_id bigint NOT NULL,
    profile_id text NOT NULL,
    weekly_xp integer DEFAULT 0 NOT NULL,
    rank integer,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: league_group_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.league_group_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: league_group_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.league_group_members_id_seq OWNED BY public.league_group_members.id;


--
-- Name: league_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_groups (
    id bigint NOT NULL,
    tier text NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    is_legends_group boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT league_groups_tier_check CHECK ((tier = ANY (ARRAY['BRONZE'::text, 'PRATA'::text, 'OURO'::text, 'DIAMANTE'::text, 'LENDAS'::text])))
);


--
-- Name: league_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.league_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: league_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.league_groups_id_seq OWNED BY public.league_groups.id;


--
-- Name: league_standings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_standings (
    profile_id text NOT NULL,
    current_tier text DEFAULT 'faisca'::text NOT NULL,
    last_week_rank integer,
    last_week_result text,
    CONSTRAINT league_standings_current_tier_check CHECK ((current_tier = ANY (ARRAY['faisca'::text, 'chama'::text, 'aura'::text, 'nucleo'::text]))),
    CONSTRAINT league_standings_last_week_result_check CHECK ((last_week_result = ANY (ARRAY['promoted'::text, 'demoted'::text, 'stayed'::text])))
);


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reactions (
    message_id bigint NOT NULL,
    message_kind text NOT NULL,
    user_id text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_reactions_message_kind_check CHECK ((message_kind = ANY (ARRAY['GROUP'::text, 'DM'::text])))
);


--
-- Name: monthly_recap_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_recap_history (
    id integer NOT NULL,
    recap_id bigint NOT NULL,
    profile_id text NOT NULL,
    recap_month date NOT NULL,
    total_focus_minutes integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    streak_start_date date,
    streak_end_date date,
    streak_is_alive boolean DEFAULT false NOT NULL,
    league_at_start text,
    league_at_end text NOT NULL,
    league_promoted boolean DEFAULT false NOT NULL,
    productivity_tag text,
    garden_count integer DEFAULT 0 NOT NULL,
    total_xp integer DEFAULT 0 NOT NULL,
    xp_sources jsonb,
    generation_number integer DEFAULT 1 NOT NULL,
    generation_count integer DEFAULT 1 NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    coins_gained integer DEFAULT 0 NOT NULL,
    coins_spent integer DEFAULT 0 NOT NULL,
    missions_completed integer DEFAULT 0 NOT NULL,
    goals_completed integer DEFAULT 0 NOT NULL,
    achievements_unlocked integer DEFAULT 0 NOT NULL,
    top_focus_category text
);


--
-- Name: monthly_recap_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_recap_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_recap_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_recap_history_id_seq OWNED BY public.monthly_recap_history.id;


--
-- Name: monthly_recaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_recaps (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    recap_month date NOT NULL,
    total_focus_minutes integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    league_tier text,
    league_promoted boolean DEFAULT false,
    productivity_tag text,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    has_been_shared boolean DEFAULT false,
    total_xp integer DEFAULT 0 NOT NULL,
    league_at_start text,
    generation_number integer DEFAULT 1 NOT NULL,
    xp_sources jsonb,
    streak_start_date date,
    streak_end_date date,
    streak_is_alive boolean DEFAULT false NOT NULL,
    status text DEFAULT 'parcial'::text NOT NULL,
    finalized_at timestamp with time zone,
    coins_gained integer DEFAULT 0 NOT NULL,
    coins_spent integer DEFAULT 0 NOT NULL,
    missions_completed integer DEFAULT 0 NOT NULL,
    goals_completed integer DEFAULT 0 NOT NULL,
    achievements_unlocked integer DEFAULT 0 NOT NULL,
    top_focus_category text,
    CONSTRAINT monthly_recaps_status_check CHECK ((status = ANY (ARRAY['live'::text, 'final'::text])))
);


--
-- Name: monthly_recaps_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_recaps_backup (
    id bigint,
    profile_id text,
    recap_month date,
    total_focus_minutes integer,
    longest_streak integer,
    league_tier text,
    league_promoted boolean,
    productivity_tag text,
    generated_at timestamp with time zone,
    has_been_shared boolean
);


--
-- Name: monthly_recaps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_recaps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_recaps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_recaps_id_seq OWNED BY public.monthly_recaps.id;


--
-- Name: pinned_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pinned_messages (
    message_id bigint NOT NULL,
    message_kind text NOT NULL,
    pinned_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    conversation_id text,
    expires_at timestamp with time zone,
    CONSTRAINT pinned_messages_message_kind_check CHECK ((message_kind = ANY (ARRAY['GROUP'::text, 'DM'::text])))
);


--
-- Name: product_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_questions (
    id text NOT NULL,
    "productId" text NOT NULL,
    "userId" text,
    author_name text NOT NULL,
    question text NOT NULL,
    answer text,
    answered_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: profile_daily_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_daily_tasks (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    title text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    icon_type text DEFAULT 'asset'::text NOT NULL,
    icon_value text DEFAULT 'target'::text NOT NULL,
    color text DEFAULT '#71d4ff'::text NOT NULL,
    frequency_type text DEFAULT 'daily'::text NOT NULL,
    frequency_days integer[],
    frequency_target integer,
    goal_type text DEFAULT 'check'::text NOT NULL,
    target_value numeric,
    unit text,
    current_progress numeric DEFAULT 0 NOT NULL,
    description text,
    category text,
    start_date date,
    reminder_time time without time zone,
    archived boolean DEFAULT false NOT NULL,
    daily_target integer DEFAULT 1 NOT NULL,
    CONSTRAINT profile_daily_tasks_daily_target_check CHECK ((daily_target >= 1))
);


--
-- Name: profile_daily_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profile_daily_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profile_daily_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profile_daily_tasks_id_seq OWNED BY public.profile_daily_tasks.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id text NOT NULL,
    display_name text NOT NULL,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    photo_url text,
    last_active_at timestamp with time zone,
    current_streak integer DEFAULT 0 NOT NULL,
    longest_streak integer DEFAULT 0 NOT NULL,
    has_custom_banner boolean DEFAULT false NOT NULL,
    banner_image_url text,
    equipped_decoration_id text,
    streak_shield_count integer DEFAULT 0 NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    highest_league_tier public.league_tier,
    equipped_shield_design_id text,
    featured_achievements text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
);


--
-- Name: project_briefings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_briefings (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    whatsapp text NOT NULL,
    company_name text,
    service_slug text NOT NULL,
    service_name text NOT NULL,
    budget text,
    deadline text,
    project_description text NOT NULL,
    main_goal text,
    target_audience text,
    "references" text,
    "desiredFeatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
    has_domain boolean,
    has_hosting boolean,
    has_branding boolean,
    preferred_contact text,
    extra_notes text,
    landing_page_goal text,
    landing_page_product text,
    landing_page_needs_form boolean,
    landing_page_needs_whatsapp boolean,
    landing_page_needs_lead_capture boolean,
    landing_page_needs_email_marketing boolean,
    site_pages_count integer,
    site_pages_list jsonb,
    site_needs_admin boolean,
    site_needs_blog boolean,
    site_needs_seo boolean,
    app_needs_login boolean,
    app_needs_admin boolean,
    app_needs_database boolean,
    app_needs_api boolean,
    app_needs_payments boolean,
    app_user_types_count integer,
    app_main_features text,
    status public."BriefingStatus" DEFAULT 'PENDING'::public."BriefingStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: room_join_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_join_requests (
    id bigint NOT NULL,
    room_id bigint NOT NULL,
    requester_profile_id text NOT NULL,
    selected_energy_type text,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    responded_by_profile_id text,
    CONSTRAINT room_join_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: room_join_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_join_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_join_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_join_requests_id_seq OWNED BY public.room_join_requests.id;


--
-- Name: room_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_participants (
    id bigint NOT NULL,
    room_id bigint NOT NULL,
    profile_id text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    session_status public.participant_session_status DEFAULT 'waiting'::public.participant_session_status NOT NULL,
    selected_energy_type text,
    completed_at timestamp with time zone,
    gave_up_at timestamp with time zone,
    restart_choice text DEFAULT 'pending'::text NOT NULL
);


--
-- Name: room_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_participants_id_seq OWNED BY public.room_participants.id;


--
-- Name: store_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_settings (
    id text DEFAULT 'singleton'::text NOT NULL,
    "storeName" text DEFAULT 'Café Store'::text NOT NULL,
    "storeDescription" text,
    "storeEmail" text,
    "whatsappNumber" text,
    "logoUrl" text,
    "faviconUrl" text,
    "primaryColor" text DEFAULT '#f97316'::text NOT NULL,
    "maintenanceMode" boolean DEFAULT false NOT NULL,
    mercado_pago_public_key text,
    mercado_pago_access_token text,
    accept_pix boolean DEFAULT true NOT NULL,
    accept_credit_card boolean DEFAULT true NOT NULL,
    accept_boleto boolean DEFAULT true NOT NULL,
    accept_paypal boolean DEFAULT false NOT NULL,
    pix_expiration text DEFAULT '30min'::text NOT NULL,
    max_installments integer DEFAULT 12 NOT NULL,
    discount_on_cash numeric(5,2) DEFAULT 0 NOT NULL,
    enable_free_shipping boolean DEFAULT false NOT NULL,
    free_shipping_amount numeric(10,2),
    show_estimated_delivery boolean DEFAULT true NOT NULL,
    calculate_shipping boolean DEFAULT true NOT NULL,
    processing_days integer DEFAULT 1 NOT NULL,
    delivery_message text,
    show_tracking boolean DEFAULT true NOT NULL,
    notify_new_order boolean DEFAULT true NOT NULL,
    notify_paid_order boolean DEFAULT true NOT NULL,
    notify_cancelled_order boolean DEFAULT true NOT NULL,
    notify_new_user boolean DEFAULT true NOT NULL,
    notify_new_feedback boolean DEFAULT true NOT NULL,
    notify_new_briefing boolean DEFAULT true NOT NULL,
    notify_low_stock boolean DEFAULT true NOT NULL,
    low_stock_threshold integer DEFAULT 5 NOT NULL,
    admin_emails text,
    meta_title text,
    meta_description text,
    canonical_url text,
    allow_indexing boolean DEFAULT true NOT NULL,
    google_analytics_id text,
    facebook_pixel_id text,
    sitemap_url text,
    require_two_factor_admin boolean DEFAULT false NOT NULL,
    block_concurrent_sessions boolean DEFAULT false NOT NULL,
    session_expiration text DEFAULT '24h'::text NOT NULL,
    require_strong_password boolean DEFAULT true NOT NULL,
    show_announcement_banner boolean DEFAULT true NOT NULL,
    announcement_text text,
    force_dark_mode text DEFAULT 'auto'::text NOT NULL,
    show_reviews_on_home boolean DEFAULT true NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: streak_day_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_day_log (
    profile_id text NOT NULL,
    log_date date NOT NULL,
    status public.streak_day_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: streak_shield_designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_shield_designs (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    icon_url text NOT NULL,
    price integer NOT NULL,
    rarity text DEFAULT 'common'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT streak_shield_designs_rarity_check CHECK ((rarity = ANY (ARRAY['common'::text, 'uncommon'::text, 'rare'::text, 'epic'::text, 'legendary'::text])))
);


--
-- Name: streak_shield_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_shield_usage (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    used_on_date date NOT NULL,
    streak_value_at_use integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: streak_shield_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.streak_shield_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: streak_shield_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.streak_shield_usage_id_seq OWNED BY public.streak_shield_usage.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    title text NOT NULL,
    due_date date NOT NULL,
    completed_at timestamp with time zone,
    start_time time without time zone,
    end_time time without time zone,
    category_id bigint NOT NULL
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: user_achievement_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievement_progress (
    profile_id text NOT NULL,
    achievement_id text NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    unlocked_tier integer DEFAULT 0 NOT NULL,
    seen_at timestamp with time zone,
    unlocked_at timestamp with time zone,
    is_featured boolean DEFAULT false NOT NULL,
    featured_order integer
);


--
-- Name: user_auras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_auras (
    profile_id text NOT NULL,
    aura_type text NOT NULL,
    unlocked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_auras_aura_type_check CHECK ((aura_type = ANY (ARRAY['flame'::text, 'water'::text, 'thunder'::text, 'ice'::text, 'wind'::text, 'metal'::text, 'poison'::text, 'earth'::text, 'light'::text, 'shadow'::text, 'cosmic'::text, 'crystal'::text])))
);


--
-- Name: user_daily_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_daily_tasks (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    task_id bigint,
    task_date date NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text
);


--
-- Name: user_daily_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_daily_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_daily_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_daily_tasks_id_seq OWNED BY public.user_daily_tasks.id;


--
-- Name: user_decorations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_decorations (
    profile_id text NOT NULL,
    decoration_id text NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_potions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_potions (
    profile_id text NOT NULL,
    item_type text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_quest_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_quest_progress (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    quest_id bigint NOT NULL,
    quest_date date NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    is_claimed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_quest_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_quest_progress_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_quest_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_quest_progress_id_seq OWNED BY public.user_quest_progress.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    profile_id text NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    preferred_theme text DEFAULT 'system'::text NOT NULL,
    sleep_time time without time zone,
    focus_time time without time zone,
    coins integer DEFAULT 0 NOT NULL,
    sound_notifications_enabled boolean DEFAULT true NOT NULL,
    last_selected_aura text,
    onboarding_completed boolean DEFAULT false NOT NULL,
    reminder_checkin_enabled boolean DEFAULT false NOT NULL,
    reminder_focus_enabled boolean DEFAULT false NOT NULL,
    reminder_sleep_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT user_settings_preferred_theme_check CHECK ((preferred_theme = ANY (ARRAY['system'::text, 'light'::text, 'dark'::text])))
);


--
-- Name: user_streak_shield_designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_streak_shield_designs (
    profile_id text NOT NULL,
    shield_design_id text NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_xp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_xp (
    profile_id text NOT NULL,
    total_xp integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: weekly_plan_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_plan_occurrences (
    id integer NOT NULL,
    series_id integer NOT NULL,
    occurrence_date date NOT NULL,
    completed_at timestamp with time zone,
    skipped boolean DEFAULT false NOT NULL,
    override_title text,
    override_start_time time without time zone,
    reminder_offset_min integer
);


--
-- Name: weekly_plan_occurrences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_plan_occurrences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_plan_occurrences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_plan_occurrences_id_seq OWNED BY public.weekly_plan_occurrences.id;


--
-- Name: weekly_plan_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_plan_series (
    id integer NOT NULL,
    profile_id text NOT NULL,
    title text NOT NULL,
    category_id integer NOT NULL,
    icon_type text DEFAULT 'asset'::text,
    icon_value text,
    color text,
    note text,
    repeat_type text DEFAULT 'once'::text NOT NULL,
    repeat_days integer[],
    repeat_interval integer,
    start_time time without time zone,
    duration_minutes integer,
    start_date date NOT NULL,
    end_type text DEFAULT 'never'::text NOT NULL,
    end_date date,
    end_count integer,
    timezone text DEFAULT 'America/Sao_Paulo'::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reminder_offset_min integer
);


--
-- Name: weekly_plan_series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_plan_series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_plan_series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_plan_series_id_seq OWNED BY public.weekly_plan_series.id;


--
-- Name: weekly_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_plans (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    plan_date date,
    title text NOT NULL,
    task_id bigint,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    all_day boolean DEFAULT true NOT NULL,
    category_id bigint NOT NULL,
    reminder_offset_min integer
);


--
-- Name: weekly_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_plans_id_seq OWNED BY public.weekly_plans.id;


--
-- Name: xp_boost_purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_boost_purchase_requests (
    profile_id text NOT NULL,
    idempotency_key uuid NOT NULL,
    requested_quantity integer NOT NULL,
    balance integer NOT NULL,
    potion_quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_ledger (
    id bigint NOT NULL,
    profile_id text NOT NULL,
    source text NOT NULL,
    source_id text,
    xp_amount integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coins_amount integer DEFAULT 0 NOT NULL
);


--
-- Name: xp_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.xp_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: xp_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.xp_ledger_id_seq OWNED BY public.xp_ledger.id;


--
-- Name: achievement_progress_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_progress_events ALTER COLUMN id SET DEFAULT nextval('public.achievement_progress_events_id_seq'::regclass);


--
-- Name: achievement_rewards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_rewards ALTER COLUMN id SET DEFAULT nextval('public.achievement_rewards_id_seq'::regclass);


--
-- Name: calendar_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections ALTER COLUMN id SET DEFAULT nextval('public.calendar_connections_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: daily_checkins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins ALTER COLUMN id SET DEFAULT nextval('public.daily_checkins_id_seq'::regclass);


--
-- Name: daily_mission_claims id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_mission_claims ALTER COLUMN id SET DEFAULT nextval('public.daily_mission_claims_id_seq'::regclass);


--
-- Name: daily_quests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quests ALTER COLUMN id SET DEFAULT nextval('public.daily_quests_id_seq'::regclass);


--
-- Name: daily_task_pool id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_task_pool ALTER COLUMN id SET DEFAULT nextval('public.daily_task_pool_id_seq'::regclass);


--
-- Name: direct_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages ALTER COLUMN id SET DEFAULT nextval('public.direct_messages_id_seq'::regclass);


--
-- Name: external_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_events ALTER COLUMN id SET DEFAULT nextval('public.external_events_id_seq'::regclass);


--
-- Name: focus_rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_rooms ALTER COLUMN id SET DEFAULT nextval('public.focus_rooms_id_seq'::regclass);


--
-- Name: focus_session_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_session_events ALTER COLUMN id SET DEFAULT nextval('public.focus_session_events_id_seq'::regclass);


--
-- Name: focus_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_sessions ALTER COLUMN id SET DEFAULT nextval('public.focus_sessions_id_seq'::regclass);


--
-- Name: friendships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships ALTER COLUMN id SET DEFAULT nextval('public.friendships_id_seq'::regclass);


--
-- Name: garden_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garden_entries ALTER COLUMN id SET DEFAULT nextval('public.garden_entries_id_seq'::regclass);


--
-- Name: goal_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_logs ALTER COLUMN id SET DEFAULT nextval('public.goal_logs_id_seq'::regclass);


--
-- Name: goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals ALTER COLUMN id SET DEFAULT nextval('public.goals_id_seq'::regclass);


--
-- Name: group_achievement_claims id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievement_claims ALTER COLUMN id SET DEFAULT nextval('public.group_achievement_claims_id_seq'::regclass);


--
-- Name: group_activity_milestones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_activity_milestones ALTER COLUMN id SET DEFAULT nextval('public.group_activity_milestones_id_seq'::regclass);


--
-- Name: group_focus_contributions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_contributions ALTER COLUMN id SET DEFAULT nextval('public.group_focus_contributions_id_seq'::regclass);


--
-- Name: group_invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invites ALTER COLUMN id SET DEFAULT nextval('public.group_invites_id_seq'::regclass);


--
-- Name: group_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_messages ALTER COLUMN id SET DEFAULT nextval('public.group_messages_id_seq'::regclass);


--
-- Name: group_milestone_claims id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_milestone_claims ALTER COLUMN id SET DEFAULT nextval('public.group_milestone_claims_id_seq'::regclass);


--
-- Name: group_weekly_quest_claims id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quest_claims ALTER COLUMN id SET DEFAULT nextval('public.group_weekly_quest_claims_id_seq'::regclass);


--
-- Name: group_weekly_quests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quests ALTER COLUMN id SET DEFAULT nextval('public.group_weekly_quests_id_seq'::regclass);


--
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- Name: habits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits ALTER COLUMN id SET DEFAULT nextval('public.habits_id_seq'::regclass);


--
-- Name: insights id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights ALTER COLUMN id SET DEFAULT nextval('public.insights_id_seq'::regclass);


--
-- Name: kanban_labels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_labels ALTER COLUMN id SET DEFAULT nextval('public.kanban_labels_id_seq'::regclass);


--
-- Name: kanban_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_tasks ALTER COLUMN id SET DEFAULT nextval('public.kanban_tasks_id_seq'::regclass);


--
-- Name: league_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_entries ALTER COLUMN id SET DEFAULT nextval('public.league_entries_id_seq'::regclass);


--
-- Name: league_group_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_group_members ALTER COLUMN id SET DEFAULT nextval('public.league_group_members_id_seq'::regclass);


--
-- Name: league_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_groups ALTER COLUMN id SET DEFAULT nextval('public.league_groups_id_seq'::regclass);


--
-- Name: monthly_recap_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recap_history ALTER COLUMN id SET DEFAULT nextval('public.monthly_recap_history_id_seq'::regclass);


--
-- Name: monthly_recaps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recaps ALTER COLUMN id SET DEFAULT nextval('public.monthly_recaps_id_seq'::regclass);


--
-- Name: profile_daily_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_daily_tasks ALTER COLUMN id SET DEFAULT nextval('public.profile_daily_tasks_id_seq'::regclass);


--
-- Name: room_join_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_join_requests ALTER COLUMN id SET DEFAULT nextval('public.room_join_requests_id_seq'::regclass);


--
-- Name: room_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_participants ALTER COLUMN id SET DEFAULT nextval('public.room_participants_id_seq'::regclass);


--
-- Name: streak_shield_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_shield_usage ALTER COLUMN id SET DEFAULT nextval('public.streak_shield_usage_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: user_daily_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_tasks ALTER COLUMN id SET DEFAULT nextval('public.user_daily_tasks_id_seq'::regclass);


--
-- Name: user_quest_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quest_progress ALTER COLUMN id SET DEFAULT nextval('public.user_quest_progress_id_seq'::regclass);


--
-- Name: weekly_plan_occurrences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_occurrences ALTER COLUMN id SET DEFAULT nextval('public.weekly_plan_occurrences_id_seq'::regclass);


--
-- Name: weekly_plan_series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_series ALTER COLUMN id SET DEFAULT nextval('public.weekly_plan_series_id_seq'::regclass);


--
-- Name: weekly_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans ALTER COLUMN id SET DEFAULT nextval('public.weekly_plans_id_seq'::regclass);


--
-- Name: xp_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_ledger ALTER COLUMN id SET DEFAULT nextval('public.xp_ledger_id_seq'::regclass);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Address Address_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);


--
-- Name: Banner Banner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Banner"
    ADD CONSTRAINT "Banner_pkey" PRIMARY KEY (id);


--
-- Name: Cart Cart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: CouponUsage CouponUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CouponUsage"
    ADD CONSTRAINT "CouponUsage_pkey" PRIMARY KEY (id);


--
-- Name: Coupon Coupon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Coupon"
    ADD CONSTRAINT "Coupon_pkey" PRIMARY KEY (id);


--
-- Name: Favorite Favorite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: Review Review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Wishlist Wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: achievement_progress_events achievement_progress_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_progress_events
    ADD CONSTRAINT achievement_progress_events_pkey PRIMARY KEY (id);


--
-- Name: achievement_progress_events achievement_progress_events_profile_id_achievement_id_sourc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_progress_events
    ADD CONSTRAINT achievement_progress_events_profile_id_achievement_id_sourc_key UNIQUE (profile_id, achievement_id, source_id);


--
-- Name: achievement_rewards achievement_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_rewards
    ADD CONSTRAINT achievement_rewards_pkey PRIMARY KEY (id);


--
-- Name: achievement_rewards achievement_rewards_profile_id_achievement_id_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_rewards
    ADD CONSTRAINT achievement_rewards_profile_id_achievement_id_tier_key UNIQUE (profile_id, achievement_id, tier);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: active_xp_boost active_xp_boost_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_xp_boost
    ADD CONSTRAINT active_xp_boost_pkey PRIMARY KEY (profile_id);


--
-- Name: avatar_decorations avatar_decorations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_decorations
    ADD CONSTRAINT avatar_decorations_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_profile_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_profile_id_provider_key UNIQUE (profile_id, provider);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: daily_checkins daily_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_pkey PRIMARY KEY (id);


--
-- Name: daily_checkins daily_checkins_profile_id_checkin_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_profile_id_checkin_date_key UNIQUE (profile_id, checkin_date);


--
-- Name: daily_habit_bonus_log daily_habit_bonus_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_habit_bonus_log
    ADD CONSTRAINT daily_habit_bonus_log_pkey PRIMARY KEY (profile_id, bonus_date);


--
-- Name: daily_mission_claims daily_mission_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_mission_claims
    ADD CONSTRAINT daily_mission_claims_pkey PRIMARY KEY (id);


--
-- Name: daily_mission_claims daily_mission_claims_user_id_mission_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_mission_claims
    ADD CONSTRAINT daily_mission_claims_user_id_mission_id_date_key UNIQUE (user_id, mission_id, date);


--
-- Name: daily_quests daily_quests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quests
    ADD CONSTRAINT daily_quests_pkey PRIMARY KEY (id);


--
-- Name: daily_quests daily_quests_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_quests
    ADD CONSTRAINT daily_quests_title_key UNIQUE (title);


--
-- Name: daily_task_log daily_task_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_task_log
    ADD CONSTRAINT daily_task_log_pkey PRIMARY KEY (task_id, log_date);


--
-- Name: daily_task_pool daily_task_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_task_pool
    ADD CONSTRAINT daily_task_pool_pkey PRIMARY KEY (id);


--
-- Name: daily_task_pool daily_task_pool_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_task_pool
    ADD CONSTRAINT daily_task_pool_title_key UNIQUE (title);


--
-- Name: direct_messages direct_messages_message_type_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.direct_messages
    ADD CONSTRAINT direct_messages_message_type_check CHECK ((message_type = ANY (ARRAY['TEXT'::text, 'IMAGE'::text, 'VIDEO'::text, 'STICKER'::text, 'AUDIO'::text, 'DOCUMENT'::text]))) NOT VALID;


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: dm_reads dm_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reads
    ADD CONSTRAINT dm_reads_pkey PRIMARY KEY (profile_id, other_id);


--
-- Name: external_events external_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_events
    ADD CONSTRAINT external_events_pkey PRIMARY KEY (id);


--
-- Name: external_events external_events_profile_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_events
    ADD CONSTRAINT external_events_profile_id_external_id_key UNIQUE (profile_id, external_id);


--
-- Name: feedback_helpful feedback_helpful_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_helpful
    ADD CONSTRAINT feedback_helpful_pkey PRIMARY KEY (id);


--
-- Name: feedbacks feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);


--
-- Name: focus_rooms focus_rooms_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_rooms
    ADD CONSTRAINT focus_rooms_code_key UNIQUE (code);


--
-- Name: focus_rooms focus_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_rooms
    ADD CONSTRAINT focus_rooms_pkey PRIMARY KEY (id);


--
-- Name: focus_session_events focus_session_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_session_events
    ADD CONSTRAINT focus_session_events_pkey PRIMARY KEY (id);


--
-- Name: focus_session_events focus_session_events_profile_id_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_session_events
    ADD CONSTRAINT focus_session_events_profile_id_session_id_key UNIQUE (profile_id, session_id);


--
-- Name: focus_sessions focus_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: garden_entries garden_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garden_entries
    ADD CONSTRAINT garden_entries_pkey PRIMARY KEY (id);


--
-- Name: goal_logs goal_logs_goal_id_log_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_goal_id_log_date_key UNIQUE (goal_id, log_date);


--
-- Name: goal_logs goal_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: group_achievement_claims group_achievement_claims_achievement_id_group_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievement_claims
    ADD CONSTRAINT group_achievement_claims_achievement_id_group_id_profile_id_key UNIQUE (achievement_id, group_id, profile_id);


--
-- Name: group_achievement_claims group_achievement_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievement_claims
    ADD CONSTRAINT group_achievement_claims_pkey PRIMARY KEY (id);


--
-- Name: group_achievements group_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_pkey PRIMARY KEY (id, group_id);


--
-- Name: group_activity_milestones group_activity_milestones_group_id_threshold_minutes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_activity_milestones
    ADD CONSTRAINT group_activity_milestones_group_id_threshold_minutes_key UNIQUE (group_id, threshold_minutes);


--
-- Name: group_activity_milestones group_activity_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_activity_milestones
    ADD CONSTRAINT group_activity_milestones_pkey PRIMARY KEY (id);


--
-- Name: group_focus_contributions group_focus_contributions_group_id_profile_id_focus_session_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_contributions
    ADD CONSTRAINT group_focus_contributions_group_id_profile_id_focus_session_key UNIQUE (group_id, profile_id, focus_session_id);


--
-- Name: group_focus_contributions group_focus_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_contributions
    ADD CONSTRAINT group_focus_contributions_pkey PRIMARY KEY (id);


--
-- Name: group_focus_room_presence group_focus_room_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_room_presence
    ADD CONSTRAINT group_focus_room_presence_pkey PRIMARY KEY (group_id, room_id, profile_id);


--
-- Name: group_invites group_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invites
    ADD CONSTRAINT group_invites_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, profile_id);


--
-- Name: group_messages group_messages_message_type_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.group_messages
    ADD CONSTRAINT group_messages_message_type_check CHECK ((message_type = ANY (ARRAY['TEXT'::text, 'IMAGE'::text, 'VIDEO'::text, 'STICKER'::text, 'AUDIO'::text, 'DOCUMENT'::text]))) NOT VALID;


--
-- Name: group_messages group_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_messages
    ADD CONSTRAINT group_messages_pkey PRIMARY KEY (id);


--
-- Name: group_milestone_claims group_milestone_claims_group_id_profile_id_threshold_minute_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_milestone_claims
    ADD CONSTRAINT group_milestone_claims_group_id_profile_id_threshold_minute_key UNIQUE (group_id, profile_id, threshold_minutes);


--
-- Name: group_milestone_claims group_milestone_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_milestone_claims
    ADD CONSTRAINT group_milestone_claims_pkey PRIMARY KEY (id);


--
-- Name: group_reads group_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_reads
    ADD CONSTRAINT group_reads_pkey PRIMARY KEY (profile_id, group_id);


--
-- Name: group_weekly_quest_claims group_weekly_quest_claims_group_id_profile_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quest_claims
    ADD CONSTRAINT group_weekly_quest_claims_group_id_profile_id_week_start_key UNIQUE (group_id, profile_id, week_start);


--
-- Name: group_weekly_quest_claims group_weekly_quest_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quest_claims
    ADD CONSTRAINT group_weekly_quest_claims_pkey PRIMARY KEY (id);


--
-- Name: group_weekly_quests group_weekly_quests_group_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quests
    ADD CONSTRAINT group_weekly_quests_group_id_week_start_key UNIQUE (group_id, week_start);


--
-- Name: group_weekly_quests group_weekly_quests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quests
    ADD CONSTRAINT group_weekly_quests_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: habit_completions habit_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_pkey PRIMARY KEY (habit_id, completed_date);


--
-- Name: habits habits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_pkey PRIMARY KEY (id);


--
-- Name: insights insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_pkey PRIMARY KEY (id);


--
-- Name: insights insights_profile_id_week_start_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_profile_id_week_start_kind_key UNIQUE (profile_id, week_start, kind);


--
-- Name: kanban_labels kanban_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_labels
    ADD CONSTRAINT kanban_labels_pkey PRIMARY KEY (id);


--
-- Name: kanban_tasks kanban_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_tasks
    ADD CONSTRAINT kanban_tasks_pkey PRIMARY KEY (id);


--
-- Name: league_entries league_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_entries
    ADD CONSTRAINT league_entries_pkey PRIMARY KEY (id);


--
-- Name: league_entries league_entries_profile_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_entries
    ADD CONSTRAINT league_entries_profile_id_week_start_key UNIQUE (profile_id, week_start);


--
-- Name: league_group_members league_group_members_league_group_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_group_members
    ADD CONSTRAINT league_group_members_league_group_id_profile_id_key UNIQUE (league_group_id, profile_id);


--
-- Name: league_group_members league_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_group_members
    ADD CONSTRAINT league_group_members_pkey PRIMARY KEY (id);


--
-- Name: league_groups league_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_groups
    ADD CONSTRAINT league_groups_pkey PRIMARY KEY (id);


--
-- Name: league_groups league_groups_tier_week_start_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_groups
    ADD CONSTRAINT league_groups_tier_week_start_date_key UNIQUE (tier, week_start_date);


--
-- Name: league_standings league_standings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_standings
    ADD CONSTRAINT league_standings_pkey PRIMARY KEY (profile_id);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (message_id, message_kind, user_id, emoji);


--
-- Name: monthly_recap_history monthly_recap_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recap_history
    ADD CONSTRAINT monthly_recap_history_pkey PRIMARY KEY (id);


--
-- Name: monthly_recap_history monthly_recap_history_profile_id_recap_month_generation_num_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recap_history
    ADD CONSTRAINT monthly_recap_history_profile_id_recap_month_generation_num_key UNIQUE (profile_id, recap_month, generation_number);


--
-- Name: monthly_recaps monthly_recaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recaps
    ADD CONSTRAINT monthly_recaps_pkey PRIMARY KEY (id);


--
-- Name: monthly_recaps monthly_recaps_profile_id_recap_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recaps
    ADD CONSTRAINT monthly_recaps_profile_id_recap_month_key UNIQUE (profile_id, recap_month);


--
-- Name: pinned_messages pinned_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_messages
    ADD CONSTRAINT pinned_messages_pkey PRIMARY KEY (message_id, message_kind);


--
-- Name: product_questions product_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_questions
    ADD CONSTRAINT product_questions_pkey PRIMARY KEY (id);


--
-- Name: profile_daily_tasks profile_daily_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_daily_tasks
    ADD CONSTRAINT profile_daily_tasks_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_briefings project_briefings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_briefings
    ADD CONSTRAINT project_briefings_pkey PRIMARY KEY (id);


--
-- Name: room_join_requests room_join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_join_requests
    ADD CONSTRAINT room_join_requests_pkey PRIMARY KEY (id);


--
-- Name: room_participants room_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_pkey PRIMARY KEY (id);


--
-- Name: room_participants room_participants_room_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_room_id_profile_id_key UNIQUE (room_id, profile_id);


--
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);


--
-- Name: streak_day_log streak_day_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_day_log
    ADD CONSTRAINT streak_day_log_pkey PRIMARY KEY (profile_id, log_date);


--
-- Name: streak_shield_designs streak_shield_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_shield_designs
    ADD CONSTRAINT streak_shield_designs_pkey PRIMARY KEY (id);


--
-- Name: streak_shield_usage streak_shield_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_shield_usage
    ADD CONSTRAINT streak_shield_usage_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_achievement_progress user_achievement_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievement_progress
    ADD CONSTRAINT user_achievement_progress_pkey PRIMARY KEY (profile_id, achievement_id);


--
-- Name: user_auras user_auras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auras
    ADD CONSTRAINT user_auras_pkey PRIMARY KEY (profile_id, aura_type);


--
-- Name: user_daily_tasks user_daily_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_tasks
    ADD CONSTRAINT user_daily_tasks_pkey PRIMARY KEY (id);


--
-- Name: user_daily_tasks user_daily_tasks_profile_id_task_id_task_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_tasks
    ADD CONSTRAINT user_daily_tasks_profile_id_task_id_task_date_key UNIQUE (profile_id, task_id, task_date);


--
-- Name: user_decorations user_decorations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decorations
    ADD CONSTRAINT user_decorations_pkey PRIMARY KEY (profile_id, decoration_id);


--
-- Name: user_potions user_potions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_potions
    ADD CONSTRAINT user_potions_pkey PRIMARY KEY (profile_id, item_type);


--
-- Name: user_quest_progress user_quest_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_pkey PRIMARY KEY (id);


--
-- Name: user_quest_progress user_quest_progress_profile_id_quest_id_quest_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_profile_id_quest_id_quest_date_key UNIQUE (profile_id, quest_id, quest_date);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (profile_id);


--
-- Name: user_streak_shield_designs user_streak_shield_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streak_shield_designs
    ADD CONSTRAINT user_streak_shield_designs_pkey PRIMARY KEY (profile_id, shield_design_id);


--
-- Name: user_xp user_xp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_pkey PRIMARY KEY (profile_id);


--
-- Name: weekly_plan_occurrences weekly_plan_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_occurrences
    ADD CONSTRAINT weekly_plan_occurrences_pkey PRIMARY KEY (id);


--
-- Name: weekly_plan_occurrences weekly_plan_occurrences_series_id_occurrence_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_occurrences
    ADD CONSTRAINT weekly_plan_occurrences_series_id_occurrence_date_key UNIQUE (series_id, occurrence_date);


--
-- Name: weekly_plan_series weekly_plan_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_series
    ADD CONSTRAINT weekly_plan_series_pkey PRIMARY KEY (id);


--
-- Name: weekly_plans weekly_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_pkey PRIMARY KEY (id);


--
-- Name: xp_boost_purchase_requests xp_boost_purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_boost_purchase_requests
    ADD CONSTRAINT xp_boost_purchase_requests_pkey PRIMARY KEY (profile_id, idempotency_key);


--
-- Name: xp_ledger xp_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_ledger
    ADD CONSTRAINT xp_ledger_pkey PRIMARY KEY (id);


--
-- Name: xp_ledger xp_ledger_source_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.xp_ledger
    ADD CONSTRAINT xp_ledger_source_check CHECK ((source = ANY (ARRAY['task'::text, 'kanban'::text, 'kanban_task'::text, 'weekly_plan'::text, 'weekly_plan_occurrence'::text, 'focus'::text, 'streak_bonus'::text, 'daily_quest'::text, 'habit_completion'::text, 'daily_task'::text, 'checkin'::text, 'checkin_streak'::text, 'goal'::text, 'achievement'::text]))) NOT VALID;


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: -
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Cart_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Cart_productId_idx" ON public."Cart" USING btree ("productId");


--
-- Name: Cart_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Cart_userId_productId_key" ON public."Cart" USING btree ("userId", "productId");


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: CouponUsage_couponId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CouponUsage_couponId_idx" ON public."CouponUsage" USING btree ("couponId");


--
-- Name: CouponUsage_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CouponUsage_userId_idx" ON public."CouponUsage" USING btree ("userId");


--
-- Name: Coupon_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Coupon_code_key" ON public."Coupon" USING btree (code);


--
-- Name: Favorite_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Favorite_productId_idx" ON public."Favorite" USING btree ("productId");


--
-- Name: Favorite_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Favorite_userId_productId_key" ON public."Favorite" USING btree ("userId", "productId");


--
-- Name: Payment_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_orderId_idx" ON public."Payment" USING btree ("orderId");


--
-- Name: Payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_status_idx" ON public."Payment" USING btree (status);


--
-- Name: Payment_transactionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Payment_transactionId_key" ON public."Payment" USING btree ("transactionId");


--
-- Name: Payment_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_userId_idx" ON public."Payment" USING btree ("userId");


--
-- Name: Product_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_sku_key" ON public."Product" USING btree (sku);


--
-- Name: Product_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_slug_key" ON public."Product" USING btree (slug);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: User_cpf_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_cpf_key" ON public."User" USING btree (cpf);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Wishlist_userId_productId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON public."Wishlist" USING btree ("userId", "productId");


--
-- Name: achievement_progress_events_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievement_progress_events_profile_idx ON public.achievement_progress_events USING btree (profile_id, achievement_id);


--
-- Name: achievement_rewards_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX achievement_rewards_profile_idx ON public.achievement_rewards USING btree (profile_id);


--
-- Name: active_xp_boost_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX active_xp_boost_expires_idx ON public.active_xp_boost USING btree (expires_at);


--
-- Name: calendar_connections_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX calendar_connections_profile_idx ON public.calendar_connections USING btree (profile_id);


--
-- Name: categories_scope_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_scope_name_idx ON public.categories USING btree (COALESCE(user_id, ''::text), lower(name));


--
-- Name: categories_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_user_idx ON public.categories USING btree (user_id);


--
-- Name: daily_checkins_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_checkins_profile_date_idx ON public.daily_checkins USING btree (profile_id, checkin_date DESC);


--
-- Name: daily_mission_claims_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_mission_claims_user_date_idx ON public.daily_mission_claims USING btree (user_id, date);


--
-- Name: daily_quests_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_quests_active_idx ON public.daily_quests USING btree (is_active);


--
-- Name: daily_quests_metric_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_quests_metric_idx ON public.daily_quests USING btree (metric);


--
-- Name: dm_pair_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dm_pair_idx ON public.direct_messages USING btree (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC);


--
-- Name: dm_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dm_recipient_idx ON public.direct_messages USING btree (recipient_id, created_at DESC);


--
-- Name: dm_reply_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dm_reply_idx ON public.direct_messages USING btree (reply_to_id);


--
-- Name: external_events_connection_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_events_connection_idx ON public.external_events USING btree (connection_id);


--
-- Name: external_events_profile_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_events_profile_time_idx ON public.external_events USING btree (profile_id, start_time, end_time);


--
-- Name: feedback_helpful_feedback_id_fingerprint_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX feedback_helpful_feedback_id_fingerprint_key ON public.feedback_helpful USING btree (feedback_id, fingerprint);


--
-- Name: focus_rooms_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX focus_rooms_code_idx ON public.focus_rooms USING btree (code);


--
-- Name: focus_rooms_host_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX focus_rooms_host_idx ON public.focus_rooms USING btree (host_profile_id);


--
-- Name: focus_rooms_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX focus_rooms_status_idx ON public.focus_rooms USING btree (status);


--
-- Name: focus_session_events_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX focus_session_events_profile_idx ON public.focus_session_events USING btree (profile_id);


--
-- Name: focus_sessions_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX focus_sessions_profile_idx ON public.focus_sessions USING btree (profile_id, started_at DESC);


--
-- Name: focus_sessions_room_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX focus_sessions_room_idx ON public.focus_sessions USING btree (room_id);


--
-- Name: friendships_addressee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX friendships_addressee_idx ON public.friendships USING btree (addressee_id, status);


--
-- Name: friendships_pair_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX friendships_pair_idx ON public.friendships USING btree (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));


--
-- Name: friendships_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX friendships_requester_idx ON public.friendships USING btree (requester_id, status);


--
-- Name: garden_entries_legacy_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX garden_entries_legacy_key_idx ON public.garden_entries USING btree (profile_id, legacy_key) WHERE (legacy_key IS NOT NULL);


--
-- Name: garden_entries_profile_planted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX garden_entries_profile_planted_idx ON public.garden_entries USING btree (profile_id, planted_at DESC);


--
-- Name: goal_logs_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goal_logs_profile_date_idx ON public.goal_logs USING btree (profile_id, log_date);


--
-- Name: goals_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goals_category_id_idx ON public.goals USING btree (category_id);


--
-- Name: goals_profile_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goals_profile_deadline_idx ON public.goals USING btree (profile_id, deadline);


--
-- Name: goals_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX goals_profile_idx ON public.goals USING btree (profile_id);


--
-- Name: group_focus_contributions_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_focus_contributions_group_idx ON public.group_focus_contributions USING btree (group_id, contributed_at DESC);


--
-- Name: group_focus_contributions_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_focus_contributions_profile_idx ON public.group_focus_contributions USING btree (profile_id, contributed_at DESC);


--
-- Name: group_focus_contributions_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_focus_contributions_session_idx ON public.group_focus_contributions USING btree (focus_session_id);


--
-- Name: group_focus_room_presence_fresh_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_focus_room_presence_fresh_idx ON public.group_focus_room_presence USING btree (group_id, room_id, last_heartbeat);


--
-- Name: group_invites_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_invites_group_idx ON public.group_invites USING btree (group_id, status);


--
-- Name: group_invites_invited_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_invites_invited_profile_idx ON public.group_invites USING btree (invited_profile_id, status);


--
-- Name: group_invites_pending_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX group_invites_pending_unique_idx ON public.group_invites USING btree (group_id, invited_profile_id) WHERE (status = 'pending'::text);


--
-- Name: group_members_banned_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_banned_idx ON public.group_members USING btree (group_id) WHERE is_banned;


--
-- Name: group_members_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_profile_idx ON public.group_members USING btree (profile_id);


--
-- Name: group_messages_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_messages_group_idx ON public.group_messages USING btree (group_id, created_at DESC);


--
-- Name: group_messages_reply_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_messages_reply_idx ON public.group_messages USING btree (reply_to_id);


--
-- Name: habit_completions_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX habit_completions_profile_date_idx ON public.habit_completions USING btree (profile_id, completed_date);


--
-- Name: habits_goal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX habits_goal_idx ON public.habits USING btree (goal_id);


--
-- Name: idx_feedbacks_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_approved ON public.feedbacks USING btree (is_approved, created_at);


--
-- Name: idx_feedbacks_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_featured ON public.feedbacks USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_feedbacks_featured_services; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_featured_services ON public.feedbacks USING btree (is_featured_services, featured_services_order) WHERE ((is_featured_services = true) AND (is_approved = true));


--
-- Name: idx_feedbacks_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_order ON public.feedbacks USING btree (order_id);


--
-- Name: idx_feedbacks_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_product ON public.feedbacks USING btree (product_id);


--
-- Name: idx_feedbacks_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_service ON public.feedbacks USING btree (service_type);


--
-- Name: idx_feedbacks_status_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_status_priority ON public.feedbacks USING btree (status, priority);


--
-- Name: idx_feedbacks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedbacks_user ON public.feedbacks USING btree (user_id);


--
-- Name: idx_wpo_series_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wpo_series_date ON public.weekly_plan_occurrences USING btree (series_id, occurrence_date);


--
-- Name: idx_wps_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wps_profile ON public.weekly_plan_series USING btree (profile_id, archived);


--
-- Name: insights_profile_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX insights_profile_week_idx ON public.insights USING btree (profile_id, week_start DESC);


--
-- Name: kanban_labels_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kanban_labels_profile_idx ON public.kanban_labels USING btree (profile_id);


--
-- Name: kanban_tasks_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kanban_tasks_category_id_idx ON public.kanban_tasks USING btree (category_id);


--
-- Name: kanban_tasks_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kanban_tasks_profile_idx ON public.kanban_tasks USING btree (profile_id, status, "position");


--
-- Name: league_entries_week_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX league_entries_week_tier_idx ON public.league_entries USING btree (week_start, tier, xp DESC);


--
-- Name: league_group_members_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX league_group_members_group_idx ON public.league_group_members USING btree (league_group_id);


--
-- Name: league_group_members_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX league_group_members_profile_idx ON public.league_group_members USING btree (profile_id);


--
-- Name: league_group_members_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX league_group_members_week_idx ON public.league_group_members USING btree (league_group_id, weekly_xp DESC);


--
-- Name: league_groups_is_legends_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX league_groups_is_legends_idx ON public.league_groups USING btree (is_legends_group);


--
-- Name: league_groups_tier_week_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX league_groups_tier_week_idx ON public.league_groups USING btree (tier, week_start_date);


--
-- Name: lgm_group_xp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lgm_group_xp_idx ON public.league_group_members USING btree (league_group_id, weekly_xp DESC);


--
-- Name: lgm_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lgm_profile_idx ON public.league_group_members USING btree (profile_id);


--
-- Name: message_reactions_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_reactions_message_idx ON public.message_reactions USING btree (message_id, message_kind);


--
-- Name: monthly_recap_history_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_recap_history_month_idx ON public.monthly_recap_history USING btree (recap_month);


--
-- Name: monthly_recap_history_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_recap_history_profile_idx ON public.monthly_recap_history USING btree (profile_id, recap_month DESC);


--
-- Name: monthly_recaps_finalized_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_recaps_finalized_at_idx ON public.monthly_recaps USING btree (finalized_at DESC) WHERE (finalized_at IS NOT NULL);


--
-- Name: monthly_recaps_top_focus_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_recaps_top_focus_category_idx ON public.monthly_recaps USING btree (top_focus_category) WHERE (top_focus_category IS NOT NULL);


--
-- Name: pinned_messages_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pinned_messages_kind_idx ON public.pinned_messages USING btree (message_kind, message_id);


--
-- Name: pinned_messages_one_per_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pinned_messages_one_per_conversation_idx ON public.pinned_messages USING btree (message_kind, conversation_id) WHERE (conversation_id IS NOT NULL);


--
-- Name: product_questions_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_questions_productId_idx" ON public.product_questions USING btree ("productId");


--
-- Name: product_questions_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "product_questions_userId_idx" ON public.product_questions USING btree ("userId");


--
-- Name: profile_daily_tasks_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_daily_tasks_profile_idx ON public.profile_daily_tasks USING btree (profile_id, sort_order, id);


--
-- Name: profiles_username_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles USING btree (lower(username)) WHERE (username IS NOT NULL);


--
-- Name: room_join_requests_pending_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX room_join_requests_pending_unique_idx ON public.room_join_requests USING btree (room_id, requester_profile_id) WHERE (status = 'pending'::text);


--
-- Name: room_join_requests_requester_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_join_requests_requester_idx ON public.room_join_requests USING btree (requester_profile_id);


--
-- Name: room_join_requests_room_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_join_requests_room_idx ON public.room_join_requests USING btree (room_id);


--
-- Name: room_join_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_join_requests_status_idx ON public.room_join_requests USING btree (status);


--
-- Name: room_participants_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_participants_profile_idx ON public.room_participants USING btree (profile_id);


--
-- Name: room_participants_room_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX room_participants_room_idx ON public.room_participants USING btree (room_id);


--
-- Name: streak_shield_usage_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX streak_shield_usage_profile_date_idx ON public.streak_shield_usage USING btree (profile_id, used_on_date);


--
-- Name: tasks_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_category_id_idx ON public.tasks USING btree (category_id);


--
-- Name: tasks_profile_due_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_profile_due_date_idx ON public.tasks USING btree (profile_id, due_date);


--
-- Name: user_auras_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_auras_profile_idx ON public.user_auras USING btree (profile_id);


--
-- Name: user_daily_tasks_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_daily_tasks_profile_date_idx ON public.user_daily_tasks USING btree (profile_id, task_date);


--
-- Name: user_quest_progress_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_quest_progress_profile_date_idx ON public.user_quest_progress USING btree (profile_id, quest_date);


--
-- Name: user_quest_progress_quest_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_quest_progress_quest_date_idx ON public.user_quest_progress USING btree (quest_id, quest_date);


--
-- Name: weekly_plans_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_plans_category_id_idx ON public.weekly_plans USING btree (category_id);


--
-- Name: weekly_plans_profile_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_plans_profile_date_idx ON public.weekly_plans USING btree (profile_id, plan_date);


--
-- Name: weekly_plans_unscheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_plans_unscheduled_idx ON public.weekly_plans USING btree (profile_id) WHERE (plan_date IS NULL);


--
-- Name: xp_ledger_dedupe_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX xp_ledger_dedupe_idx ON public.xp_ledger USING btree (profile_id, source, COALESCE(source_id, ''::text));


--
-- Name: xp_ledger_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX xp_ledger_profile_idx ON public.xp_ledger USING btree (profile_id, created_at DESC);


--
-- Name: user_achievement_progress focus_companion_progress_no_regression; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER focus_companion_progress_no_regression BEFORE UPDATE ON public.user_achievement_progress FOR EACH ROW EXECUTE FUNCTION public.prevent_focus_companion_regression();


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: -
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Address Address_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Address"
    ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Cart Cart_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Cart Cart_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cart"
    ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Favorite Favorite_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OrderItem OrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Payment Payment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Payment Payment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Review Review_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Review Review_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Review"
    ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wishlist Wishlist_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Wishlist Wishlist_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: achievement_progress_events achievement_progress_events_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_progress_events
    ADD CONSTRAINT achievement_progress_events_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: achievement_progress_events achievement_progress_events_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_progress_events
    ADD CONSTRAINT achievement_progress_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: achievement_rewards achievement_rewards_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_rewards
    ADD CONSTRAINT achievement_rewards_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: achievement_rewards achievement_rewards_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_rewards
    ADD CONSTRAINT achievement_rewards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: active_xp_boost active_xp_boost_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_xp_boost
    ADD CONSTRAINT active_xp_boost_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: calendar_connections calendar_connections_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_checkins daily_checkins_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_checkins
    ADD CONSTRAINT daily_checkins_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_habit_bonus_log daily_habit_bonus_log_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_habit_bonus_log
    ADD CONSTRAINT daily_habit_bonus_log_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_mission_claims daily_mission_claims_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_mission_claims
    ADD CONSTRAINT daily_mission_claims_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.daily_quests(id) ON DELETE CASCADE;


--
-- Name: daily_mission_claims daily_mission_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_mission_claims
    ADD CONSTRAINT daily_mission_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_task_log daily_task_log_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_task_log
    ADD CONSTRAINT daily_task_log_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.profile_daily_tasks(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: direct_messages direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dm_reads dm_reads_other_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reads
    ADD CONSTRAINT dm_reads_other_id_fkey FOREIGN KEY (other_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dm_reads dm_reads_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dm_reads
    ADD CONSTRAINT dm_reads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: external_events external_events_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_events
    ADD CONSTRAINT external_events_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.calendar_connections(id) ON DELETE CASCADE;


--
-- Name: external_events external_events_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_events
    ADD CONSTRAINT external_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: feedback_helpful feedback_helpful_feedback_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_helpful
    ADD CONSTRAINT feedback_helpful_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES public.feedbacks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feedbacks feedbacks_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: feedbacks feedbacks_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_product_id_fkey FOREIGN KEY (product_id) REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: feedbacks feedbacks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: profiles fk_profiles_equipped_shield; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT fk_profiles_equipped_shield FOREIGN KEY (equipped_shield_design_id) REFERENCES public.streak_shield_designs(id) ON DELETE SET NULL;


--
-- Name: focus_rooms focus_rooms_host_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_rooms
    ADD CONSTRAINT focus_rooms_host_profile_id_fkey FOREIGN KEY (host_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: focus_session_events focus_session_events_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_session_events
    ADD CONSTRAINT focus_session_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: focus_sessions focus_sessions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: focus_sessions focus_sessions_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.focus_rooms(id) ON DELETE SET NULL;


--
-- Name: focus_sessions focus_sessions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.focus_sessions
    ADD CONSTRAINT focus_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: friendships friendships_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: garden_entries garden_entries_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garden_entries
    ADD CONSTRAINT garden_entries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: garden_entries garden_entries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.garden_entries
    ADD CONSTRAINT garden_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.focus_sessions(id) ON DELETE CASCADE;


--
-- Name: goal_logs goal_logs_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: goal_logs goal_logs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goal_logs
    ADD CONSTRAINT goal_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: goals goals_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: goals goals_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_achievement_claims group_achievement_claims_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievement_claims
    ADD CONSTRAINT group_achievement_claims_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_achievement_claims group_achievement_claims_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievement_claims
    ADD CONSTRAINT group_achievement_claims_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_achievements group_achievements_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_achievements
    ADD CONSTRAINT group_achievements_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_activity_milestones group_activity_milestones_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_activity_milestones
    ADD CONSTRAINT group_activity_milestones_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_focus_contributions group_focus_contributions_focus_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_contributions
    ADD CONSTRAINT group_focus_contributions_focus_session_id_fkey FOREIGN KEY (focus_session_id) REFERENCES public.focus_sessions(id) ON DELETE CASCADE;


--
-- Name: group_focus_contributions group_focus_contributions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_contributions
    ADD CONSTRAINT group_focus_contributions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_focus_contributions group_focus_contributions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_contributions
    ADD CONSTRAINT group_focus_contributions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_focus_room_presence group_focus_room_presence_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_room_presence
    ADD CONSTRAINT group_focus_room_presence_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_focus_room_presence group_focus_room_presence_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_room_presence
    ADD CONSTRAINT group_focus_room_presence_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_focus_room_presence group_focus_room_presence_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_focus_room_presence
    ADD CONSTRAINT group_focus_room_presence_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.focus_rooms(id) ON DELETE CASCADE;


--
-- Name: group_invites group_invites_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invites
    ADD CONSTRAINT group_invites_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_invites group_invites_invited_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invites
    ADD CONSTRAINT group_invites_invited_by_profile_id_fkey FOREIGN KEY (invited_by_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_invites group_invites_invited_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_invites
    ADD CONSTRAINT group_invites_invited_profile_id_fkey FOREIGN KEY (invited_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_messages group_messages_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_messages
    ADD CONSTRAINT group_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_messages group_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_messages
    ADD CONSTRAINT group_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_milestone_claims group_milestone_claims_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_milestone_claims
    ADD CONSTRAINT group_milestone_claims_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_milestone_claims group_milestone_claims_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_milestone_claims
    ADD CONSTRAINT group_milestone_claims_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_reads group_reads_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_reads
    ADD CONSTRAINT group_reads_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_reads group_reads_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_reads
    ADD CONSTRAINT group_reads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_weekly_quest_claims group_weekly_quest_claims_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quest_claims
    ADD CONSTRAINT group_weekly_quest_claims_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_weekly_quest_claims group_weekly_quest_claims_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quest_claims
    ADD CONSTRAINT group_weekly_quest_claims_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_weekly_quests group_weekly_quests_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_weekly_quests
    ADD CONSTRAINT group_weekly_quests_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: groups groups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: habit_completions habit_completions_habit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;


--
-- Name: habit_completions habit_completions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: habits habits_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- Name: insights insights_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insights
    ADD CONSTRAINT insights_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: kanban_labels kanban_labels_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_labels
    ADD CONSTRAINT kanban_labels_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: kanban_tasks kanban_tasks_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_tasks
    ADD CONSTRAINT kanban_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: kanban_tasks kanban_tasks_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_tasks
    ADD CONSTRAINT kanban_tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: kanban_tasks kanban_tasks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kanban_tasks
    ADD CONSTRAINT kanban_tasks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: league_entries league_entries_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_entries
    ADD CONSTRAINT league_entries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: league_group_members league_group_members_league_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_group_members
    ADD CONSTRAINT league_group_members_league_group_id_fkey FOREIGN KEY (league_group_id) REFERENCES public.league_groups(id) ON DELETE CASCADE;


--
-- Name: league_group_members league_group_members_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_group_members
    ADD CONSTRAINT league_group_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: league_standings league_standings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_standings
    ADD CONSTRAINT league_standings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: monthly_recap_history monthly_recap_history_recap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recap_history
    ADD CONSTRAINT monthly_recap_history_recap_id_fkey FOREIGN KEY (recap_id) REFERENCES public.monthly_recaps(id) ON DELETE CASCADE;


--
-- Name: monthly_recaps monthly_recaps_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_recaps
    ADD CONSTRAINT monthly_recaps_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pinned_messages pinned_messages_pinned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pinned_messages
    ADD CONSTRAINT pinned_messages_pinned_by_fkey FOREIGN KEY (pinned_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: product_questions product_questions_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_questions
    ADD CONSTRAINT "product_questions_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_questions product_questions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_questions
    ADD CONSTRAINT "product_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: profile_daily_tasks profile_daily_tasks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_daily_tasks
    ADD CONSTRAINT profile_daily_tasks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: room_join_requests room_join_requests_requester_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_join_requests
    ADD CONSTRAINT room_join_requests_requester_profile_id_fkey FOREIGN KEY (requester_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: room_join_requests room_join_requests_responded_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_join_requests
    ADD CONSTRAINT room_join_requests_responded_by_profile_id_fkey FOREIGN KEY (responded_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: room_join_requests room_join_requests_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_join_requests
    ADD CONSTRAINT room_join_requests_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.focus_rooms(id) ON DELETE CASCADE;


--
-- Name: room_participants room_participants_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: room_participants room_participants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_participants
    ADD CONSTRAINT room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.focus_rooms(id) ON DELETE CASCADE;


--
-- Name: streak_day_log streak_day_log_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_day_log
    ADD CONSTRAINT streak_day_log_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: streak_shield_usage streak_shield_usage_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_shield_usage
    ADD CONSTRAINT streak_shield_usage_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: tasks tasks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_achievement_progress user_achievement_progress_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievement_progress
    ADD CONSTRAINT user_achievement_progress_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: user_achievement_progress user_achievement_progress_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievement_progress
    ADD CONSTRAINT user_achievement_progress_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_auras user_auras_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auras
    ADD CONSTRAINT user_auras_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_daily_tasks user_daily_tasks_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_tasks
    ADD CONSTRAINT user_daily_tasks_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_daily_tasks user_daily_tasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_tasks
    ADD CONSTRAINT user_daily_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.daily_task_pool(id) ON DELETE CASCADE;


--
-- Name: user_decorations user_decorations_decoration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decorations
    ADD CONSTRAINT user_decorations_decoration_id_fkey FOREIGN KEY (decoration_id) REFERENCES public.avatar_decorations(id) ON DELETE CASCADE;


--
-- Name: user_decorations user_decorations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decorations
    ADD CONSTRAINT user_decorations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_potions user_potions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_potions
    ADD CONSTRAINT user_potions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_quest_progress user_quest_progress_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_quest_progress user_quest_progress_quest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_quest_progress
    ADD CONSTRAINT user_quest_progress_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES public.daily_quests(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_streak_shield_designs user_streak_shield_designs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streak_shield_designs
    ADD CONSTRAINT user_streak_shield_designs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_streak_shield_designs user_streak_shield_designs_shield_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streak_shield_designs
    ADD CONSTRAINT user_streak_shield_designs_shield_design_id_fkey FOREIGN KEY (shield_design_id) REFERENCES public.streak_shield_designs(id) ON DELETE CASCADE;


--
-- Name: user_xp user_xp_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_xp
    ADD CONSTRAINT user_xp_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: weekly_plan_occurrences weekly_plan_occurrences_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_occurrences
    ADD CONSTRAINT weekly_plan_occurrences_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.weekly_plan_series(id) ON DELETE CASCADE;


--
-- Name: weekly_plan_series weekly_plan_series_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_series
    ADD CONSTRAINT weekly_plan_series_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: weekly_plan_series weekly_plan_series_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plan_series
    ADD CONSTRAINT weekly_plan_series_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: weekly_plans weekly_plans_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: weekly_plans weekly_plans_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: weekly_plans weekly_plans_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_plans
    ADD CONSTRAINT weekly_plans_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: xp_boost_purchase_requests xp_boost_purchase_requests_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_boost_purchase_requests
    ADD CONSTRAINT xp_boost_purchase_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: xp_ledger xp_ledger_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_ledger
    ADD CONSTRAINT xp_ledger_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict cdhQLrq128XoCsuVF3HUbH4iMUM6pqflzjKBZTda1FiKjQNCEQU6NmS55nvab3R
