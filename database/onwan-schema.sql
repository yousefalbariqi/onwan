--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6 (Postgres.app)

--
-- Name: prevent_reserved_username(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_reserved_username() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if exists (
    select 1
    from reserved_usernames
    where reserved_usernames.username = new.username
  ) then
    raise exception 'username "%" is reserved', new.username;
  end if;

  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_setup_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_setup_tokens (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid,
    staff_name text NOT NULL,
    action character varying(60) NOT NULL,
    target_type character varying(30),
    target_id text,
    target_label text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid NOT NULL,
    snapshot_json jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reason text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_reviews_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: page_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid NOT NULL,
    title character varying(120) NOT NULL,
    url text NOT NULL,
    platform character varying(50),
    sort_order integer DEFAULT 0 NOT NULL,
    icon_style character varying(20),
    text_position character varying(20),
    link_type character varying(20) DEFAULT 'url'::character varying NOT NULL,
    file_name text,
    file_mime_type character varying(100),
    file_size integer,
    file_category character varying(20),
    is_hidden boolean DEFAULT false NOT NULL
);


--
-- Name: page_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid,
    username character varying(50) NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_at timestamp with time zone,
    handled_by text
);


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name character varying(100),
    bio text,
    profile_image_url text,
    theme_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    wallpaper_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    button_style_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    profile_style_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    custom_colors_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extracted_colors_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    suspension_message text,
    suspended_at timestamp with time zone,
    contact_phone character varying(20),
    contact_email character varying(255),
    typography_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    suspension_reason text,
    CONSTRAINT pages_status_chk CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: partner_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    order_id uuid NOT NULL,
    kind character varying(20) NOT NULL,
    amount numeric(10,2),
    rate numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_commissions_kind_check CHECK (((kind)::text = ANY ((ARRAY['first'::character varying, 'renewal'::character varying])::text[])))
);


--
-- Name: partner_order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_order_number_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number integer DEFAULT nextval('public.partner_order_number_seq'::regclass) NOT NULL,
    partner_id uuid NOT NULL,
    customer_name character varying(160) NOT NULL,
    customer_phone character varying(20) NOT NULL,
    customer_email character varying(255) NOT NULL,
    username character varying(50) NOT NULL,
    plan character varying(20) NOT NULL,
    sale_price numeric(10,2) NOT NULL,
    partner_price numeric(10,2) NOT NULL,
    page_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    terms_accepted_at timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'awaiting_payment'::character varying NOT NULL,
    payment_token text NOT NULL,
    payment_reference text,
    link_sent_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_orders_plan_check CHECK (((plan)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[]))),
    CONSTRAINT partner_orders_status_check CHECK (((status)::text = ANY ((ARRAY['awaiting_payment'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: partner_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    partner_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    renewals_count integer DEFAULT 0 NOT NULL,
    note text,
    recorded_by text NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partner_payouts_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_name character varying(160) NOT NULL,
    contact_name character varying(120) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    city character varying(80),
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    status_reason text,
    price_monthly numeric(10,2),
    price_annual numeric(10,2),
    renewal_rate numeric(5,2) DEFAULT 30 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT partners_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'suspended'::character varying, 'violation'::character varying, 'rejected'::character varying, 'deleted'::character varying])::text[])))
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    plan character varying(20) NOT NULL,
    price_sar numeric(10,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_plan_check CHECK (((plan)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[])))
);


--
-- Name: reserved_usernames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reserved_usernames (
    username character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(120) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) DEFAULT 'staff'::character varying NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_role_check CHECK (((role)::text = ANY ((ARRAY['manager'::character varying, 'staff'::character varying])::text[])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending_payment'::character varying NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    payment_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_price numeric(10,2),
    CONSTRAINT subscriptions_plan_check CHECK (((plan)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying])::text[]))),
    CONSTRAINT subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['pending_payment'::character varying, 'active'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: support_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(30) NOT NULL,
    message text NOT NULL,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    due_at timestamp with time zone,
    internal_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_by text,
    CONSTRAINT support_requests_status_check CHECK (((status)::text = ANY ((ARRAY['in_progress'::character varying, 'completed'::character varying, 'stalled'::character varying])::text[]))),
    CONSTRAINT support_requests_type_check CHECK (((type)::text = ANY ((ARRAY['message'::character varying, 'pause_page'::character varying, 'reactivate_page'::character varying, 'delete_account'::character varying, 'change_subdomain'::character varying, 'stop_renewal'::character varying, 'more_storage'::character varying, 'invoice'::character varying])::text[])))
);


--
-- Name: username_redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.username_redirects (
    old_username character varying(50) NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usernames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usernames (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT usernames_format_chk CHECK ((((username)::text = lower((username)::text)) AND ((username)::text ~ '^(?=.{1,30}$)(?!.*--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$'::text)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email character varying(255),
    password_hash text,
    email_verified_at timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    ban_reason text,
    banned_at timestamp with time zone,
    CONSTRAINT users_status_chk CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'banned'::character varying])::text[])))
);


--
-- Name: verification_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    code character varying(6) NOT NULL,
    username character varying(50),
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    purpose character varying(30) DEFAULT 'verify_email'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL
);


--
-- Name: account_setup_tokens account_setup_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_setup_tokens
    ADD CONSTRAINT account_setup_tokens_pkey PRIMARY KEY (token_hash);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: content_reviews content_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_reviews
    ADD CONSTRAINT content_reviews_pkey PRIMARY KEY (id);


--
-- Name: page_links page_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_links
    ADD CONSTRAINT page_links_pkey PRIMARY KEY (id);


--
-- Name: page_reports page_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_reports
    ADD CONSTRAINT page_reports_pkey PRIMARY KEY (id);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: pages pages_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_user_id_key UNIQUE (user_id);


--
-- Name: partner_commissions partner_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_commissions
    ADD CONSTRAINT partner_commissions_pkey PRIMARY KEY (id);


--
-- Name: partner_orders partner_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_orders
    ADD CONSTRAINT partner_orders_order_number_key UNIQUE (order_number);


--
-- Name: partner_orders partner_orders_payment_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_orders
    ADD CONSTRAINT partner_orders_payment_token_key UNIQUE (payment_token);


--
-- Name: partner_orders partner_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_orders
    ADD CONSTRAINT partner_orders_pkey PRIMARY KEY (id);


--
-- Name: partner_payouts partner_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_pkey PRIMARY KEY (id);


--
-- Name: partners partners_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_email_key UNIQUE (email);


--
-- Name: partners partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partners
    ADD CONSTRAINT partners_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (plan);


--
-- Name: reserved_usernames reserved_usernames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reserved_usernames
    ADD CONSTRAINT reserved_usernames_pkey PRIMARY KEY (username);


--
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);


--
-- Name: support_requests support_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);


--
-- Name: username_redirects username_redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.username_redirects
    ADD CONSTRAINT username_redirects_pkey PRIMARY KEY (old_username);


--
-- Name: usernames usernames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usernames
    ADD CONSTRAINT usernames_pkey PRIMARY KEY (id);


--
-- Name: usernames usernames_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usernames
    ADD CONSTRAINT usernames_username_key UNIQUE (username);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_codes verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_codes
    ADD CONSTRAINT verification_codes_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_target ON public.audit_log USING btree (target_type, target_id, created_at DESC);


--
-- Name: idx_content_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_reviews_status ON public.content_reviews USING btree (status, created_at DESC);


--
-- Name: idx_page_links_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_links_page_id ON public.page_links USING btree (page_id);


--
-- Name: idx_page_links_page_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_links_page_sort ON public.page_links USING btree (page_id, sort_order, id);


--
-- Name: idx_page_links_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_links_sort_order ON public.page_links USING btree (page_id, sort_order);


--
-- Name: idx_page_reports_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_reports_page ON public.page_reports USING btree (page_id, created_at DESC);


--
-- Name: idx_pages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pages_user_id ON public.pages USING btree (user_id);


--
-- Name: idx_partner_commissions_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_commissions_partner ON public.partner_commissions USING btree (partner_id, created_at DESC);


--
-- Name: idx_partner_orders_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_orders_partner ON public.partner_orders USING btree (partner_id, created_at DESC);


--
-- Name: idx_partner_orders_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_orders_username ON public.partner_orders USING btree (username) WHERE ((status)::text = 'awaiting_payment'::text);


--
-- Name: idx_partner_payouts_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payouts_partner ON public.partner_payouts USING btree (partner_id, paid_at DESC);


--
-- Name: idx_support_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_requests_status ON public.support_requests USING btree (status, created_at DESC);


--
-- Name: idx_usernames_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usernames_user_id ON public.usernames USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_verification_codes_email_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_email_code ON public.verification_codes USING btree (email, code) WHERE (used = false);


--
-- Name: idx_verification_codes_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_codes_lookup ON public.verification_codes USING btree (email, purpose, created_at DESC) WHERE (used = false);


--
-- Name: pages trg_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: usernames trg_prevent_reserved_username; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_reserved_username BEFORE INSERT OR UPDATE ON public.usernames FOR EACH ROW EXECUTE FUNCTION public.prevent_reserved_username();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: account_setup_tokens account_setup_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_setup_tokens
    ADD CONSTRAINT account_setup_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: content_reviews content_reviews_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_reviews
    ADD CONSTRAINT content_reviews_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: page_links page_links_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_links
    ADD CONSTRAINT page_links_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: page_reports page_reports_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_reports
    ADD CONSTRAINT page_reports_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE SET NULL;


--
-- Name: pages pages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: partner_commissions partner_commissions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_commissions
    ADD CONSTRAINT partner_commissions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.partner_orders(id);


--
-- Name: partner_commissions partner_commissions_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_commissions
    ADD CONSTRAINT partner_commissions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: partner_orders partner_orders_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_orders
    ADD CONSTRAINT partner_orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: partner_orders partner_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_orders
    ADD CONSTRAINT partner_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: partner_payouts partner_payouts_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payouts
    ADD CONSTRAINT partner_payouts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_requests support_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: username_redirects username_redirects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.username_redirects
    ADD CONSTRAINT username_redirects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: usernames usernames_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usernames
    ADD CONSTRAINT usernames_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: account_setup_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_setup_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: partner_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: partners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: username_redirects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.username_redirects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

-- ================================================================
-- Phase 8 additions
-- The old project did not yet contain these tables. They are included
-- here so this one file matches the current application requirements.
-- ================================================================

create table if not exists public.settings (
  key varchar(60) primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.design_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'cancelled')),
  price numeric(10, 2),
  edits_total integer,
  edits_used integer not null default 0,
  payment_reference text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  design_approved_at timestamptz,
  expires_at timestamptz
);
create index if not exists idx_design_packages_user on public.design_packages (user_id, requested_at desc);

create table if not exists public.design_edits (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.design_packages(id) on delete cascade,
  note text not null,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists public.nfc_order_number_seq start 5001;
create table if not exists public.nfc_orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('public.nfc_order_number_seq'),
  user_id uuid references public.users(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  shipping_price numeric(10, 2) not null,
  total numeric(10, 2) not null,
  recipient_name varchar(160) not null,
  recipient_phone varchar(20) not null,
  city varchar(80) not null,
  address text not null,
  page_url text not null,
  status varchar(20) not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'shipped', 'cancelled')),
  payment_reference text,
  shipping_note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz
);
create index if not exists idx_nfc_orders_status on public.nfc_orders (status, created_at desc);

alter table public.users add column if not exists pending_email varchar(255);

create table if not exists public.deleted_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  link_json jsonb not null,
  deleted_by text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists idx_deleted_links_page on public.deleted_links (page_id, deleted_at desc);

create table if not exists public.page_visits_daily (
  page_id uuid not null references public.pages(id) on delete cascade,
  day date not null,
  views integer not null default 0,
  primary key (page_id, day)
);

alter table public.pages add column if not exists translations_json jsonb not null default '{}'::jsonb;
alter table public.page_links add column if not exists title_en varchar(255);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  kind varchar(30) not null check (kind in ('subscription', 'partner_subscription', 'design', 'nfc')),
  amount numeric(10, 2) not null check (amount >= 0),
  reference text,
  label text,
  recorded_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_created on public.payments (created_at desc);


