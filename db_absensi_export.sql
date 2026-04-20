--
-- PostgreSQL database dump
--

\restrict n9LsEbhr0zOPG0Wb1fWKfgjgzvjo44kWsGLxo3JDC3d6CTOgBqLfvj0OdarWC0d

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT true,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.announcements_id_seq OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: asset_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_assignments (
    id integer NOT NULL,
    asset_id integer,
    user_id integer,
    assigned_by integer,
    assigned_date date DEFAULT CURRENT_DATE NOT NULL,
    returned_date date,
    returned_to integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_assignments OWNER TO postgres;

--
-- Name: asset_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asset_assignments_id_seq OWNER TO postgres;

--
-- Name: asset_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_assignments_id_seq OWNED BY public.asset_assignments.id;


--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.asset_categories OWNER TO postgres;

--
-- Name: asset_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asset_categories_id_seq OWNER TO postgres;

--
-- Name: asset_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_categories_id_seq OWNED BY public.asset_categories.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    asset_code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    category_id integer,
    brand character varying(100),
    purchase_date date,
    price numeric(15,2),
    description text,
    photo_path character varying(255),
    status character varying(20) DEFAULT 'available'::character varying,
    current_assignee_id integer,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'assigned'::character varying, 'maintenance'::character varying, 'retired'::character varying])::text[])))
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assets_id_seq OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: attendance_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    radius_meters integer DEFAULT 100,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.attendance_locations OWNER TO postgres;

--
-- Name: attendance_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_locations_id_seq OWNER TO postgres;

--
-- Name: attendance_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_locations_id_seq OWNED BY public.attendance_locations.id;


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_records (
    id integer NOT NULL,
    user_id integer,
    location_id integer,
    type character varying(10) NOT NULL,
    photo_path character varying(255) NOT NULL,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    distance_meters numeric(10,2),
    is_valid boolean DEFAULT true,
    notes text,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attendance_records_type_check CHECK (((type)::text = ANY (ARRAY[('check_in'::character varying)::text, ('check_out'::character varying)::text])))
);


ALTER TABLE public.attendance_records OWNER TO postgres;

--
-- Name: attendance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_records_id_seq OWNER TO postgres;

--
-- Name: attendance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_records_id_seq OWNED BY public.attendance_records.id;


--
-- Name: bpjs_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bpjs_settings (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    employee_rate numeric(6,4) DEFAULT 0 NOT NULL,
    company_rate numeric(6,4) DEFAULT 0 NOT NULL,
    max_salary_base numeric(15,2) DEFAULT NULL::numeric,
    is_active boolean DEFAULT true,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.bpjs_settings OWNER TO postgres;

--
-- Name: bpjs_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bpjs_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bpjs_settings_id_seq OWNER TO postgres;

--
-- Name: bpjs_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bpjs_settings_id_seq OWNED BY public.bpjs_settings.id;


--
-- Name: candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidates (
    id integer NOT NULL,
    full_name character varying(200) NOT NULL,
    email character varying(100),
    phone character varying(20),
    address text,
    education character varying(100),
    experience_years integer DEFAULT 0,
    applied_position_id integer,
    resume_path character varying(255),
    photo_path character varying(255),
    status character varying(20) DEFAULT 'applied'::character varying,
    source character varying(30) DEFAULT 'website'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT candidates_source_check CHECK (((source)::text = ANY ((ARRAY['website'::character varying, 'referral'::character varying, 'jobfair'::character varying, 'linkedin'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT candidates_status_check CHECK (((status)::text = ANY ((ARRAY['applied'::character varying, 'screening'::character varying, 'interview'::character varying, 'test'::character varying, 'offering'::character varying, 'hired'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.candidates OWNER TO postgres;

--
-- Name: candidates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.candidates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.candidates_id_seq OWNER TO postgres;

--
-- Name: candidates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.candidates_id_seq OWNED BY public.candidates.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    address text,
    phone character varying(30),
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: discipline_assessments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.discipline_assessments (
    id integer NOT NULL,
    user_id integer,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    total_working_days integer DEFAULT 0,
    present_days integer DEFAULT 0,
    late_days integer DEFAULT 0,
    absent_days integer DEFAULT 0,
    leave_days integer DEFAULT 0,
    overtime_days integer DEFAULT 0,
    attendance_score numeric(5,2) DEFAULT 0,
    attitude_score numeric(5,2) DEFAULT 0,
    performance_score numeric(5,2) DEFAULT 0,
    final_score numeric(5,2) DEFAULT 0,
    grade character varying(2) DEFAULT 'E'::character varying,
    notes text,
    assessed_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT discipline_assessments_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12)))
);


ALTER TABLE public.discipline_assessments OWNER TO postgres;

--
-- Name: discipline_assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.discipline_assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.discipline_assessments_id_seq OWNER TO postgres;

--
-- Name: discipline_assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.discipline_assessments_id_seq OWNED BY public.discipline_assessments.id;


--
-- Name: driver_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driver_activities (
    id integer NOT NULL,
    user_id integer,
    activity_date date NOT NULL,
    is_subuh boolean DEFAULT false,
    departure_time time without time zone,
    rit_count integer DEFAULT 1,
    rit_notes text,
    is_overnight boolean DEFAULT false,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.driver_activities OWNER TO postgres;

--
-- Name: driver_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.driver_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.driver_activities_id_seq OWNER TO postgres;

--
-- Name: driver_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.driver_activities_id_seq OWNED BY public.driver_activities.id;


--
-- Name: driver_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driver_tracking (
    id integer NOT NULL,
    user_id integer,
    tracking_date date DEFAULT CURRENT_DATE NOT NULL,
    customer_name character varying(200) NOT NULL,
    address text,
    checkin_time timestamp without time zone,
    checkin_latitude numeric(10,8),
    checkin_longitude numeric(11,8),
    checkout_time timestamp without time zone,
    checkout_latitude numeric(10,8),
    checkout_longitude numeric(11,8),
    notes text,
    status character varying(20) DEFAULT 'checked_in'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    checkin_photo_path character varying(255),
    checkout_photo_path character varying(255),
    tracking_type character varying(20) DEFAULT 'delivery'::character varying,
    amount_billed numeric(15,2),
    amount_collected numeric(15,2),
    payment_method character varying(30),
    invoice_number character varying(100),
    collection_status character varying(20),
    CONSTRAINT driver_tracking_status_check CHECK (((status)::text = ANY ((ARRAY['checked_in'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.driver_tracking OWNER TO postgres;

--
-- Name: driver_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.driver_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.driver_tracking_id_seq OWNER TO postgres;

--
-- Name: driver_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.driver_tracking_id_seq OWNED BY public.driver_tracking.id;


--
-- Name: employee_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_details (
    id integer NOT NULL,
    user_id integer,
    nik character varying(20),
    phone character varying(20),
    address text,
    birth_date date,
    birth_place character varying(100),
    gender character varying(10),
    marital_status character varying(20) DEFAULT 'Belum Menikah'::character varying,
    religion character varying(20),
    education character varying(30),
    department character varying(100),
    "position" character varying(100),
    join_date date,
    bank_name character varying(50),
    bank_account character varying(30),
    bank_holder character varying(100),
    npwp character varying(30),
    bpjs_kesehatan_no character varying(30),
    bpjs_ketenagakerjaan_no character varying(30),
    basic_salary numeric(15,2) DEFAULT 0,
    transport_allowance numeric(15,2) DEFAULT 0,
    meal_allowance numeric(15,2) DEFAULT 0,
    overtime_rate numeric(15,2) DEFAULT 50000,
    tax_status character varying(10) DEFAULT 'TK/0'::character varying,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    salary_type character varying(10) DEFAULT 'monthly'::character varying,
    is_driver boolean DEFAULT false,
    driver_subuh_allowance numeric DEFAULT 0,
    driver_rit_allowance numeric DEFAULT 0,
    driver_inap_allowance numeric DEFAULT 0,
    driver_ritase_allowance numeric DEFAULT 0,
    bpjs_kes_enrolled boolean DEFAULT true,
    bpjs_jht_enrolled boolean DEFAULT true,
    bpjs_jp_enrolled boolean DEFAULT true,
    bpjs_jkk_enrolled boolean DEFAULT true,
    bpjs_jkm_enrolled boolean DEFAULT true,
    pph21_enabled boolean DEFAULT true,
    bpjs_kes_employee_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_kes_company_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_jht_employee_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_jht_company_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_jp_employee_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_jp_company_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_jkk_rate numeric(6,4) DEFAULT NULL::numeric,
    bpjs_jkm_rate numeric(6,4) DEFAULT NULL::numeric,
    no_kk character varying(20),
    is_collector boolean DEFAULT false,
    use_tracking boolean DEFAULT false,
    CONSTRAINT employee_details_gender_check CHECK (((gender)::text = ANY ((ARRAY['Laki-laki'::character varying, 'Perempuan'::character varying])::text[]))),
    CONSTRAINT employee_details_marital_status_check CHECK (((marital_status)::text = ANY ((ARRAY['Belum Menikah'::character varying, 'Menikah'::character varying, 'Cerai'::character varying])::text[])))
);


ALTER TABLE public.employee_details OWNER TO postgres;

--
-- Name: employee_details_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_details_id_seq OWNER TO postgres;

--
-- Name: employee_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_details_id_seq OWNED BY public.employee_details.id;


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_documents (
    id integer NOT NULL,
    user_id integer NOT NULL,
    doc_type character varying(50) NOT NULL,
    doc_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer DEFAULT 0,
    mime_type character varying(100),
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE public.employee_documents OWNER TO postgres;

--
-- Name: employee_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_documents_id_seq OWNER TO postgres;

--
-- Name: employee_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_documents_id_seq OWNED BY public.employee_documents.id;


--
-- Name: employee_loans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_loans (
    id integer NOT NULL,
    user_id integer,
    loan_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(15,2) NOT NULL,
    installment_amount numeric(15,2) NOT NULL,
    total_installments integer NOT NULL,
    paid_installments integer DEFAULT 0,
    remaining_balance numeric(15,2) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_loans_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paid_off'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.employee_loans OWNER TO postgres;

--
-- Name: employee_loans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_loans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_loans_id_seq OWNER TO postgres;

--
-- Name: employee_loans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_loans_id_seq OWNED BY public.employee_loans.id;


--
-- Name: employee_shift_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_shift_assignments (
    id integer NOT NULL,
    user_id integer,
    shift_id integer,
    assignment_date date NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.employee_shift_assignments OWNER TO postgres;

--
-- Name: employee_shift_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_shift_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_shift_assignments_id_seq OWNER TO postgres;

--
-- Name: employee_shift_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_shift_assignments_id_seq OWNED BY public.employee_shift_assignments.id;


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interviews (
    id integer NOT NULL,
    candidate_id integer,
    stage_id integer,
    interviewer_id integer,
    interview_date date NOT NULL,
    interview_time time without time zone,
    location character varying(200),
    type character varying(20) DEFAULT 'onsite'::character varying,
    meeting_link character varying(500),
    status character varying(20) DEFAULT 'scheduled'::character varying,
    result character varying(20),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT interviews_result_check CHECK (((result)::text = ANY ((ARRAY['passed'::character varying, 'failed'::character varying, 'pending'::character varying])::text[]))),
    CONSTRAINT interviews_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'no-show'::character varying])::text[]))),
    CONSTRAINT interviews_type_check CHECK (((type)::text = ANY ((ARRAY['online'::character varying, 'onsite'::character varying])::text[])))
);


ALTER TABLE public.interviews OWNER TO postgres;

--
-- Name: interviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.interviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.interviews_id_seq OWNER TO postgres;

--
-- Name: interviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.interviews_id_seq OWNED BY public.interviews.id;


--
-- Name: job_positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_positions (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    department character varying(100),
    description text,
    requirements text,
    salary_range_min numeric(15,2),
    salary_range_max numeric(15,2),
    employment_type character varying(20) DEFAULT 'full-time'::character varying,
    status character varying(20) DEFAULT 'open'::character varying,
    opened_date date DEFAULT CURRENT_DATE,
    closed_date date,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT job_positions_employment_type_check CHECK (((employment_type)::text = ANY ((ARRAY['full-time'::character varying, 'part-time'::character varying, 'contract'::character varying, 'internship'::character varying])::text[]))),
    CONSTRAINT job_positions_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'on-hold'::character varying])::text[])))
);


ALTER TABLE public.job_positions OWNER TO postgres;

--
-- Name: job_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.job_positions_id_seq OWNER TO postgres;

--
-- Name: job_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_positions_id_seq OWNED BY public.job_positions.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer,
    type character varying(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    attachment_path character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by integer,
    admin_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    replacement_date date,
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))),
    CONSTRAINT leave_requests_type_check CHECK (((type)::text = ANY ((ARRAY['late'::character varying, 'sick'::character varying, 'leave'::character varying, 'change_off'::character varying])::text[])))
);


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_requests_id_seq OWNER TO postgres;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: license_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.license_info (
    id integer NOT NULL,
    license_key text NOT NULL,
    company_name character varying(200),
    max_users integer DEFAULT 10 NOT NULL,
    expires_at date,
    activated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.license_info OWNER TO postgres;

--
-- Name: license_info_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.license_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.license_info_id_seq OWNER TO postgres;

--
-- Name: license_info_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.license_info_id_seq OWNED BY public.license_info.id;


--
-- Name: loan_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loan_payments (
    id integer NOT NULL,
    loan_id integer,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_method character varying(30) DEFAULT 'manual'::character varying,
    payroll_item_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT loan_payments_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['payroll_deduction'::character varying, 'manual'::character varying])::text[])))
);


ALTER TABLE public.loan_payments OWNER TO postgres;

--
-- Name: loan_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.loan_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.loan_payments_id_seq OWNER TO postgres;

--
-- Name: loan_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.loan_payments_id_seq OWNED BY public.loan_payments.id;


--
-- Name: overtime_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.overtime_records (
    id integer NOT NULL,
    user_id integer,
    date date NOT NULL,
    hours numeric(4,1) NOT NULL,
    rate_per_hour numeric(15,2) DEFAULT 50000 NOT NULL,
    total_amount numeric(15,2) DEFAULT 0 NOT NULL,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT overtime_records_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.overtime_records OWNER TO postgres;

--
-- Name: overtime_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.overtime_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.overtime_records_id_seq OWNER TO postgres;

--
-- Name: overtime_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.overtime_records_id_seq OWNED BY public.overtime_records.id;


--
-- Name: overtime_request_employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.overtime_request_employees (
    id integer NOT NULL,
    overtime_request_id integer,
    user_id integer,
    actual_hours numeric(4,1),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.overtime_request_employees OWNER TO postgres;

--
-- Name: overtime_request_employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.overtime_request_employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.overtime_request_employees_id_seq OWNER TO postgres;

--
-- Name: overtime_request_employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.overtime_request_employees_id_seq OWNED BY public.overtime_request_employees.id;


--
-- Name: overtime_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.overtime_requests (
    id integer NOT NULL,
    spl_number character varying(50),
    date date NOT NULL,
    shift_id integer,
    department character varying(100),
    overtime_start time without time zone NOT NULL,
    overtime_end time without time zone NOT NULL,
    estimated_hours numeric(4,1) NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_by integer,
    approved_by integer,
    approved_at timestamp without time zone,
    admin_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT overtime_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.overtime_requests OWNER TO postgres;

--
-- Name: overtime_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.overtime_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.overtime_requests_id_seq OWNER TO postgres;

--
-- Name: overtime_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.overtime_requests_id_seq OWNED BY public.overtime_requests.id;


--
-- Name: overtime_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.overtime_rules (
    id integer NOT NULL,
    schedule_type_id integer,
    overtime_type character varying(20) DEFAULT 'immediate'::character varying NOT NULL,
    grace_period_minutes integer DEFAULT 0,
    min_overtime_minutes integer DEFAULT 30,
    max_overtime_hours numeric(4,1) DEFAULT 4,
    rate_multiplier numeric(3,1) DEFAULT 1.5,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT overtime_rules_overtime_type_check CHECK (((overtime_type)::text = ANY ((ARRAY['immediate'::character varying, 'after_grace'::character varying])::text[])))
);


ALTER TABLE public.overtime_rules OWNER TO postgres;

--
-- Name: overtime_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.overtime_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.overtime_rules_id_seq OWNER TO postgres;

--
-- Name: overtime_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.overtime_rules_id_seq OWNED BY public.overtime_rules.id;


--
-- Name: payroll_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_items (
    id integer NOT NULL,
    payroll_run_id integer,
    user_id integer,
    basic_salary numeric(15,2) DEFAULT 0,
    transport_allowance numeric(15,2) DEFAULT 0,
    meal_allowance numeric(15,2) DEFAULT 0,
    overtime_hours numeric(6,1) DEFAULT 0,
    overtime_amount numeric(15,2) DEFAULT 0,
    bpjs_kes_employee numeric(15,2) DEFAULT 0,
    bpjs_kes_company numeric(15,2) DEFAULT 0,
    bpjs_jht_employee numeric(15,2) DEFAULT 0,
    bpjs_jht_company numeric(15,2) DEFAULT 0,
    bpjs_jp_employee numeric(15,2) DEFAULT 0,
    bpjs_jp_company numeric(15,2) DEFAULT 0,
    bpjs_jkk numeric(15,2) DEFAULT 0,
    bpjs_jkm numeric(15,2) DEFAULT 0,
    gross_income numeric(15,2) DEFAULT 0,
    pph21_amount numeric(15,2) DEFAULT 0,
    loan_deduction numeric(15,2) DEFAULT 0,
    total_deductions numeric(15,2) DEFAULT 0,
    net_salary numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    salary_type character varying(10) DEFAULT 'monthly'::character varying,
    working_days integer DEFAULT 0,
    driver_subuh_days integer DEFAULT 0,
    driver_subuh_amount numeric DEFAULT 0,
    driver_rit_total integer DEFAULT 0,
    driver_rit_amount numeric DEFAULT 0,
    driver_overnight_days integer DEFAULT 0,
    driver_overnight_amount numeric DEFAULT 0,
    driver_total_allowance numeric DEFAULT 0,
    driver_extra_rit integer DEFAULT 0,
    driver_ritase_amount numeric DEFAULT 0
);


ALTER TABLE public.payroll_items OWNER TO postgres;

--
-- Name: payroll_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payroll_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_items_id_seq OWNER TO postgres;

--
-- Name: payroll_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payroll_items_id_seq OWNED BY public.payroll_items.id;


--
-- Name: payroll_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_runs (
    id integer NOT NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    run_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payroll_runs_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT payroll_runs_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'finalized'::character varying])::text[])))
);


ALTER TABLE public.payroll_runs OWNER TO postgres;

--
-- Name: payroll_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payroll_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payroll_runs_id_seq OWNER TO postgres;

--
-- Name: payroll_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payroll_runs_id_seq OWNED BY public.payroll_runs.id;


--
-- Name: positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.positions (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.positions OWNER TO postgres;

--
-- Name: positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.positions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.positions_id_seq OWNER TO postgres;

--
-- Name: positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.positions_id_seq OWNED BY public.positions.id;


--
-- Name: recruitment_stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recruitment_stages (
    id integer NOT NULL,
    candidate_id integer,
    stage_name character varying(100) NOT NULL,
    stage_order integer DEFAULT 1,
    status character varying(20) DEFAULT 'pending'::character varying,
    scheduled_date date,
    completed_date date,
    interviewer_id integer,
    score numeric(5,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recruitment_stages_status_check CHECK (((status)::text = ANY ((ARRAY['passed'::character varying, 'failed'::character varying, 'pending'::character varying, 'in-progress'::character varying])::text[])))
);


ALTER TABLE public.recruitment_stages OWNER TO postgres;

--
-- Name: recruitment_stages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recruitment_stages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recruitment_stages_id_seq OWNER TO postgres;

--
-- Name: recruitment_stages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recruitment_stages_id_seq OWNED BY public.recruitment_stages.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.settings_id_seq OWNER TO postgres;

--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: user_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_locations (
    user_id integer NOT NULL,
    location_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_locations OWNER TO postgres;

--
-- Name: user_off_days; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_off_days (
    id integer NOT NULL,
    user_id integer,
    off_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_off_days OWNER TO postgres;

--
-- Name: user_off_days_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_off_days_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_off_days_id_seq OWNER TO postgres;

--
-- Name: user_off_days_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_off_days_id_seq OWNED BY public.user_off_days.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100),
    password character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'employee'::character varying,
    face_descriptor text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    off_day character varying(20) DEFAULT 'Minggu'::character varying
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: work_schedule_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_schedule_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    shift_count integer DEFAULT 1,
    department character varying(100),
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "position" character varying(100),
    CONSTRAINT work_schedule_types_shift_count_check CHECK (((shift_count >= 1) AND (shift_count <= 4))),
    CONSTRAINT work_schedule_types_type_check CHECK (((type)::text = ANY ((ARRAY['normal'::character varying, 'shift'::character varying])::text[])))
);


ALTER TABLE public.work_schedule_types OWNER TO postgres;

--
-- Name: work_schedule_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_schedule_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_schedule_types_id_seq OWNER TO postgres;

--
-- Name: work_schedule_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_schedule_types_id_seq OWNED BY public.work_schedule_types.id;


--
-- Name: work_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_shifts (
    id integer NOT NULL,
    schedule_type_id integer,
    name character varying(100) NOT NULL,
    shift_order integer DEFAULT 1,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_start time without time zone,
    break_end time without time zone,
    is_overnight boolean DEFAULT false,
    color character varying(7) DEFAULT '#3b82f6'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT work_shifts_shift_order_check CHECK (((shift_order >= 1) AND (shift_order <= 4)))
);


ALTER TABLE public.work_shifts OWNER TO postgres;

--
-- Name: work_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_shifts_id_seq OWNER TO postgres;

--
-- Name: work_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_shifts_id_seq OWNED BY public.work_shifts.id;


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: asset_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments ALTER COLUMN id SET DEFAULT nextval('public.asset_assignments_id_seq'::regclass);


--
-- Name: asset_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories ALTER COLUMN id SET DEFAULT nextval('public.asset_categories_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: attendance_locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_locations ALTER COLUMN id SET DEFAULT nextval('public.attendance_locations_id_seq'::regclass);


--
-- Name: attendance_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records ALTER COLUMN id SET DEFAULT nextval('public.attendance_records_id_seq'::regclass);


--
-- Name: bpjs_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bpjs_settings ALTER COLUMN id SET DEFAULT nextval('public.bpjs_settings_id_seq'::regclass);


--
-- Name: candidates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates ALTER COLUMN id SET DEFAULT nextval('public.candidates_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: discipline_assessments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discipline_assessments ALTER COLUMN id SET DEFAULT nextval('public.discipline_assessments_id_seq'::regclass);


--
-- Name: driver_activities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_activities ALTER COLUMN id SET DEFAULT nextval('public.driver_activities_id_seq'::regclass);


--
-- Name: driver_tracking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_tracking ALTER COLUMN id SET DEFAULT nextval('public.driver_tracking_id_seq'::regclass);


--
-- Name: employee_details id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details ALTER COLUMN id SET DEFAULT nextval('public.employee_details_id_seq'::regclass);


--
-- Name: employee_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents ALTER COLUMN id SET DEFAULT nextval('public.employee_documents_id_seq'::regclass);


--
-- Name: employee_loans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_loans ALTER COLUMN id SET DEFAULT nextval('public.employee_loans_id_seq'::regclass);


--
-- Name: employee_shift_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shift_assignments ALTER COLUMN id SET DEFAULT nextval('public.employee_shift_assignments_id_seq'::regclass);


--
-- Name: interviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interviews ALTER COLUMN id SET DEFAULT nextval('public.interviews_id_seq'::regclass);


--
-- Name: job_positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_positions ALTER COLUMN id SET DEFAULT nextval('public.job_positions_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: license_info id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.license_info ALTER COLUMN id SET DEFAULT nextval('public.license_info_id_seq'::regclass);


--
-- Name: loan_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_payments ALTER COLUMN id SET DEFAULT nextval('public.loan_payments_id_seq'::regclass);


--
-- Name: overtime_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_records ALTER COLUMN id SET DEFAULT nextval('public.overtime_records_id_seq'::regclass);


--
-- Name: overtime_request_employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_request_employees ALTER COLUMN id SET DEFAULT nextval('public.overtime_request_employees_id_seq'::regclass);


--
-- Name: overtime_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_requests ALTER COLUMN id SET DEFAULT nextval('public.overtime_requests_id_seq'::regclass);


--
-- Name: overtime_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_rules ALTER COLUMN id SET DEFAULT nextval('public.overtime_rules_id_seq'::regclass);


--
-- Name: payroll_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items ALTER COLUMN id SET DEFAULT nextval('public.payroll_items_id_seq'::regclass);


--
-- Name: payroll_runs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs ALTER COLUMN id SET DEFAULT nextval('public.payroll_runs_id_seq'::regclass);


--
-- Name: positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions ALTER COLUMN id SET DEFAULT nextval('public.positions_id_seq'::regclass);


--
-- Name: recruitment_stages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_stages ALTER COLUMN id SET DEFAULT nextval('public.recruitment_stages_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: user_off_days id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_off_days ALTER COLUMN id SET DEFAULT nextval('public.user_off_days_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: work_schedule_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_schedule_types ALTER COLUMN id SET DEFAULT nextval('public.work_schedule_types_id_seq'::regclass);


--
-- Name: work_shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_shifts ALTER COLUMN id SET DEFAULT nextval('public.work_shifts_id_seq'::regclass);


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.announcements (id, title, content, is_active, created_by, created_at, updated_at) FROM stdin;
2	libur lebaran	segera liburkan	t	1	2026-04-14 17:55:45.626152	2026-04-14 17:55:45.626152
\.


--
-- Data for Name: asset_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_assignments (id, asset_id, user_id, assigned_by, assigned_date, returned_date, returned_to, notes, created_at) FROM stdin;
\.


--
-- Data for Name: asset_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_categories (id, name, description, created_at, updated_at) FROM stdin;
1	Elektronik	Kategori untuk laptop, komputer, printer, dll	2026-04-18 13:46:53.865954	2026-04-18 13:46:53.865954
2	Kendaraan	Kategori untuk mobil, motor operasional	2026-04-18 13:46:53.865954	2026-04-18 13:46:53.865954
3	Mebel	Kategori untuk meja, kursi, lemari	2026-04-18 13:46:53.865954	2026-04-18 13:46:53.865954
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assets (id, asset_code, name, category_id, brand, purchase_date, price, description, photo_path, status, current_assignee_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: attendance_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_locations (id, name, latitude, longitude, radius_meters, is_active, created_at) FROM stdin;
3	TPI	-6.14006539	106.77779097	100	t	2026-04-15 15:23:42.517942
\.


--
-- Data for Name: attendance_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_records (id, user_id, location_id, type, photo_path, latitude, longitude, distance_meters, is_valid, notes, recorded_at) FROM stdin;
195	241	3	check_in	/uploads/attendance/1776322391861-241.jpg	-6.14006130	106.77779085	0.46	t	\N	2026-04-16 13:53:11.923363
196	1	3	check_in	/uploads/attendance/1776397152601-1.jpg	-6.14005696	106.77779233	0.95	t	\N	2026-04-17 10:39:12.618391
200	1	3	check_in	/uploads/attendance/1776480279911-1.jpg	-6.14006206	106.77779007	0.38	t	\N	2026-04-18 09:44:39.994037
197	1	3	check_out	/uploads/attendance/1776397356636-1.jpg	-6.14006206	106.77779007	0.38	t	\N	2026-04-17 10:42:36.699423
198	241	3	check_in	/uploads/attendance/1776398580529-241.jpg	-6.14010520	106.77760500	21.03	t	\N	2026-04-17 11:03:00.603487
199	241	3	check_out	/uploads/attendance/1776398601634-241.jpg	-6.14009880	106.77754290	27.68	t	\N	2026-04-17 11:03:21.687962
194	224	\N	check_in	/uploads/attendance/1775977165178-224.jpg	-6.20798604	107.01050770	13.72	t	\N	2026-04-12 13:59:25.201335
\.


--
-- Data for Name: bpjs_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bpjs_settings (id, code, name, description, employee_rate, company_rate, max_salary_base, is_active, updated_by, created_at, updated_at) FROM stdin;
1	BPJS_KES	BPJS Kesehatan	Jaminan Kesehatan Nasional (JKN)	0.0100	0.0400	12000000.00	t	\N	2026-04-13 13:21:57.034645	2026-04-13 13:21:57.034645
2	BPJS_JHT	BPJS JHT	Jaminan Hari Tua	0.0200	0.0370	\N	t	\N	2026-04-13 13:21:57.034645	2026-04-13 13:21:57.034645
3	BPJS_JP	BPJS JP	Jaminan Pensiun	0.0100	0.0200	10042300.00	t	\N	2026-04-13 13:21:57.034645	2026-04-13 13:21:57.034645
4	BPJS_JKK	BPJS JKK	Jaminan Kecelakaan Kerja (Kelompok I - Risiko Sangat Rendah)	0.0000	0.0024	\N	t	\N	2026-04-13 13:21:57.034645	2026-04-13 13:21:57.034645
5	BPJS_JKM	BPJS JKM	Jaminan Kematian	0.0000	0.0030	\N	t	\N	2026-04-13 13:21:57.034645	2026-04-13 13:21:57.034645
\.


--
-- Data for Name: candidates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidates (id, full_name, email, phone, address, education, experience_years, applied_position_id, resume_path, photo_path, status, source, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, address, phone, notes, is_active, created_at, updated_at) FROM stdin;
3	PT Global Elektronik	Jl. TB Simatupang No. 22, Jakarta Selatan	\N	\N	t	2026-04-16 14:24:49.359095	2026-04-16 14:24:49.359095
4	PT Maju Jaya	Jl. Raya Industri No. 45, Bekasi	\N	\N	t	2026-04-16 14:24:49.360203	2026-04-16 14:24:49.360203
5	PT Sumber Rezeki	Jl. Gatot Subroto Km. 5, Bandung	\N	\N	t	2026-04-16 14:24:49.361212	2026-04-16 14:24:49.361212
6	Sahabat jaya sukses	Angke	\N	\N	t	2026-04-16 14:24:49.362074	2026-04-16 14:24:49.362074
7	Toko Bangunan Sejahtera	Jl. Margonda Raya No. 55, Depok	\N	\N	t	2026-04-16 14:24:49.363299	2026-04-16 14:24:49.363299
8	Toko Makmur Sentosa	Jl. Pasar Baru No. 12, Jakarta Pusat	\N	\N	t	2026-04-16 14:24:49.364661	2026-04-16 14:24:49.364661
9	UD Sentral Jaya	Jl. Ahmad Yani No. 100, Cimahi	\N	\N	t	2026-04-16 14:24:49.366438	2026-04-16 14:24:49.366438
1	CV Berkah Abadi	Jl. Industri Raya No. 88, Tangerang	\N	\N	t	2026-04-16 14:24:49.353458	2026-04-16 14:32:01.072806
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, description, created_at, updated_at) FROM stdin;
1	Finance		2026-04-12 01:30:09.936603	2026-04-12 01:30:09.936603
2	Marketing		2026-04-12 01:30:58.862859	2026-04-12 01:30:58.862859
6	Gudang		2026-04-15 13:21:29.353567	2026-04-15 13:21:29.353567
7	IT		2026-04-15 13:23:11.798648	2026-04-15 13:23:11.798648
8	Accounting		2026-04-15 13:23:17.479629	2026-04-15 13:23:17.479629
9	Purchasing		2026-04-15 13:23:23.54044	2026-04-15 13:23:23.54044
\.


--
-- Data for Name: discipline_assessments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.discipline_assessments (id, user_id, period_month, period_year, total_working_days, present_days, late_days, absent_days, leave_days, overtime_days, attendance_score, attitude_score, performance_score, final_score, grade, notes, assessed_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: driver_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.driver_activities (id, user_id, activity_date, is_subuh, departure_time, rit_count, rit_notes, is_overnight, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: driver_tracking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.driver_tracking (id, user_id, tracking_date, customer_name, address, checkin_time, checkin_latitude, checkin_longitude, checkout_time, checkout_latitude, checkout_longitude, notes, status, created_at, updated_at, checkin_photo_path, checkout_photo_path, tracking_type, amount_billed, amount_collected, payment_method, invoice_number, collection_status) FROM stdin;
1	241	2026-04-16	PT Maju Jaya	Jl. Raya Industri No. 45, Bekasi	2026-04-16 08:15:00	-6.24150000	106.98760000	2026-04-16 09:30:00	-6.24200000	106.98800000	Barang sudah diterima oleh Pak Budi	completed	2026-04-16 13:55:59.676872	2026-04-16 13:55:59.676872	\N	\N	delivery	\N	\N	\N	\N	\N
2	241	2026-04-16	Toko Makmur Sentosa	Jl. Pasar Baru No. 12, Jakarta Pusat	2026-04-16 10:05:00	-6.16850000	106.84510000	2026-04-16 11:20:00	-6.16900000	106.84550000	Delivery 20 box, diterima oleh Ibu Sari	completed	2026-04-16 13:55:59.676872	2026-04-16 13:55:59.676872	\N	\N	delivery	\N	\N	\N	\N	\N
4	241	2026-04-15	PT Sumber Rezeki	Jl. Gatot Subroto Km. 5, Bandung	2026-04-15 07:45:00	-6.91750000	107.61910000	2026-04-15 09:00:00	-6.91800000	107.61950000	Pengiriman 15 karton	completed	2026-04-16 13:55:59.676872	2026-04-16 13:55:59.676872	\N	\N	delivery	\N	\N	\N	\N	\N
5	241	2026-04-15	UD Sentral Jaya	Jl. Ahmad Yani No. 100, Cimahi	2026-04-15 10:30:00	-6.88230000	107.53850000	2026-04-15 12:15:00	-6.88280000	107.53900000	Barang dikirim lengkap	completed	2026-04-16 13:55:59.676872	2026-04-16 13:55:59.676872	\N	\N	delivery	\N	\N	\N	\N	\N
6	241	2026-04-14	Toko Bangunan Sejahtera	Jl. Margonda Raya No. 55, Depok	2026-04-14 08:00:00	-6.37000000	106.83160000	2026-04-14 08:45:00	-6.37050000	106.83200000	Delivery material bangunan	completed	2026-04-16 13:55:59.676872	2026-04-16 13:55:59.676872	\N	\N	delivery	\N	\N	\N	\N	\N
7	241	2026-04-14	PT Global Elektronik	Jl. TB Simatupang No. 22, Jakarta Selatan	2026-04-14 10:00:00	-6.29330000	106.83770000	2026-04-14 11:30:00	-6.29380000	106.83800000	Pengiriman spare part elektronik	completed	2026-04-16 13:55:59.676872	2026-04-16 13:55:59.676872	\N	\N	delivery	\N	\N	\N	\N	\N
8	241	2026-04-16	Sahabat jaya sukses	Angke	2026-04-16 14:10:30.392204	-6.14007420	106.77779480	2026-04-16 14:10:36.75906	-6.14007420	106.77779480	\N	completed	2026-04-16 14:10:30.392204	2026-04-16 14:10:36.75906	\N	\N	delivery	\N	\N	\N	\N	\N
9	241	2026-04-16	CV Berkah Abadi	\N	2026-04-16 14:18:21.380713	-6.14005641	106.77779264	2026-04-16 14:18:34.316972	-6.14005641	106.77779264	\N	completed	2026-04-16 14:18:21.380713	2026-04-16 14:18:34.316972	/uploads/tracking/1776323901372-241.jpg	/uploads/tracking/1776323914312-241.jpg	delivery	\N	\N	\N	\N	\N
10	241	2026-04-16	CV Berkah Abadi	Jl. Industri Raya No. 88, Tangerang	2026-04-16 14:32:01.075948	-6.14005641	106.77779264	2026-04-16 14:32:32.474319	-6.14005641	106.77779264	\N	completed	2026-04-16 14:32:01.075948	2026-04-16 14:32:32.474319	/uploads/tracking/1776324721066-241.jpg	/uploads/tracking/1776324752469-241.jpg	delivery	\N	\N	\N	\N	\N
3	241	2026-04-16	CV Berkah Abadi	Jl. Industri Raya No. 88, Tangerang	2026-04-16 13:00:00	-6.17800000	106.63200000	2026-04-16 14:32:39.028194	-6.14005641	106.77779264	Menunggu loading barang	completed	2026-04-16 13:55:59.676872	2026-04-16 14:32:39.028194	\N	/uploads/tracking/1776324759024-241.jpg	delivery	\N	\N	\N	\N	\N
\.


--
-- Data for Name: employee_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_details (id, user_id, nik, phone, address, birth_date, birth_place, gender, marital_status, religion, education, department, "position", join_date, bank_name, bank_account, bank_holder, npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no, basic_salary, transport_allowance, meal_allowance, overtime_rate, tax_status, emergency_contact_name, emergency_contact_phone, created_at, updated_at, salary_type, is_driver, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance, driver_ritase_allowance, bpjs_kes_enrolled, bpjs_jht_enrolled, bpjs_jp_enrolled, bpjs_jkk_enrolled, bpjs_jkm_enrolled, pph21_enabled, bpjs_kes_employee_rate, bpjs_kes_company_rate, bpjs_jht_employee_rate, bpjs_jht_company_rate, bpjs_jp_employee_rate, bpjs_jp_company_rate, bpjs_jkk_rate, bpjs_jkm_rate, no_kk, is_collector, use_tracking) FROM stdin;
39	224	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Produksi	Staf	\N	\N	\N	\N	\N	\N	\N	6000000.00	3000000.00	1000000.00	60000.00	TK/0	\N	\N	2026-04-12 13:51:08.611	2026-04-12 14:17:56.296459	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f
41	225	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Produksi	Staf	\N	\N	\N	\N	\N	\N	\N	5500000.00	2000000.00	200000.00	50000.00	TK/0	\N	\N	2026-04-12 13:51:47.314147	2026-04-12 14:18:00.47156	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f
40	223	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Produksi	Staf	\N	\N	\N	\N	\N	\N	\N	7000000.00	2000000.00	2500000.00	60000.00	TK/0	\N	\N	2026-04-12 13:51:19.546571	2026-04-12 14:18:09.566026	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f
51	242	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Driver	Naker Harian	\N	\N	\N	\N	\N	\N	\N	130000.00	0.00	0.00	7500.00	TK/0	\N	\N	2026-04-14 13:42:04.148194	2026-04-14 15:07:30.106257	daily	t	30000	12500	50000	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t
52	243	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Driver	Naker Harian	\N	\N	\N	\N	\N	\N	\N	110000.00	0.00	0.00	7500.00	TK/0	\N	\N	2026-04-14 13:42:10.697556	2026-04-14 15:08:24.893043	daily	t	30000	12500	50000	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t
53	244	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Driver	Naker Harian	\N	\N	\N	\N	\N	\N	\N	120000.00	0.00	0.00	7500.00	TK/0	\N	\N	2026-04-14 13:42:17.45374	2026-04-15 14:20:30.187938	daily	t	30000	12500	50000	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t
50	241	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Driver	Naker Harian	\N	\N	\N	\N	\N	\N	\N	110000.00	0.00	0.00	7500.00	TK/0	\N	\N	2026-04-14 13:41:57.017711	2026-04-16 15:06:11.116502	daily	t	30000	12500	50000	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	t
66	1	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	0.00	0.00	50000.00	TK/0	\N	\N	2026-04-16 15:25:16.31406	2026-04-16 15:25:16.31406	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f
64	275	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Finance	Colector	\N	\N	\N	\N	\N	\N	\N	4000000.00	0.00	0.00	50000.00	TK/0	\N	\N	2026-04-16 14:36:20.08085	2026-04-16 15:28:50.370727	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t
63	274	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Finance	Colector	\N	\N	\N	\N	\N	\N	\N	3000000.00	0.00	0.00	50000.00	TK/0	\N	\N	2026-04-16 14:36:09.427157	2026-04-16 15:32:32.512108	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	t
37	217	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	Produksi	Staf	2026-03-27	BCA	\N	Wisnu	\N	1231231	4124	5000000.00	100000.00	400000.00	50000.00	TK/0	\N	\N	2026-04-12 09:49:24.562344	2026-04-17 13:36:24.104175	monthly	f	0	0	0	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f
\.


--
-- Data for Name: employee_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_documents (id, user_id, doc_type, doc_name, file_path, file_size, mime_type, uploaded_at, notes) FROM stdin;
\.


--
-- Data for Name: employee_loans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_loans (id, user_id, loan_date, amount, installment_amount, total_installments, paid_installments, remaining_balance, description, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employee_shift_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_shift_assignments (id, user_id, shift_id, assignment_date, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: interviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.interviews (id, candidate_id, stage_id, interviewer_id, interview_date, interview_time, location, type, meeting_link, status, result, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: job_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_positions (id, title, department, description, requirements, salary_range_min, salary_range_max, employment_type, status, opened_date, closed_date, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_requests (id, user_id, type, start_date, end_date, reason, attachment_path, status, approved_by, admin_notes, created_at, updated_at, replacement_date) FROM stdin;
\.


--
-- Data for Name: license_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.license_info (id, license_key, company_name, max_users, expires_at, activated_at) FROM stdin;
1	eyJjb21wYW55IjoiUFQuIEphZ2F0IFJheWEgQW5jb2wiLCJtYXhfdXNlcnMiOjE1MCwiZXhwaXJlc19hdCI6IjIwMjctMDQtMTdUMDk6MDg6MTkuMjk4WiIsImlzc3VlZF9hdCI6IjIwMjYtMDQtMTdUMDk6MDg6MTkuMzAyWiIsImlkIjoiNjJhMWE1MGMifQ==.CSmHI8wE776wBRrvSE4-ujbi8PFlIvhTNwjwWAsGCw4	PT. Jagat Raya Ancol	150	2027-04-17	2026-04-17 16:13:30.950919
\.


--
-- Data for Name: loan_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loan_payments (id, loan_id, payment_date, amount, payment_method, payroll_item_id, notes, created_at) FROM stdin;
\.


--
-- Data for Name: overtime_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.overtime_records (id, user_id, date, hours, rate_per_hour, total_amount, description, status, approved_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: overtime_request_employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.overtime_request_employees (id, overtime_request_id, user_id, actual_hours, notes, created_at) FROM stdin;
1	1	217	\N	\N	2026-04-12 10:41:54.948361
2	2	224	\N	\N	2026-04-12 13:54:29.016092
\.


--
-- Data for Name: overtime_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.overtime_requests (id, spl_number, date, shift_id, department, overtime_start, overtime_end, estimated_hours, reason, status, requested_by, approved_by, approved_at, admin_notes, created_at, updated_at) FROM stdin;
1	SPL/2026/04/0001	2026-04-13	\N	Produksi	22:01:00	23:00:00	1.0	pekerjaan belum selesai	approved	1	1	2026-04-12 10:53:42.408837	\N	2026-04-12 10:41:54.948361	2026-04-12 10:53:42.408837
2	SPL/2026/04/0002	2026-04-12	\N	\N	23:00:00	01:00:00	2.0	banyak kerjaan	approved	224	1	2026-04-12 13:54:47.079027	\N	2026-04-12 13:54:29.016092	2026-04-12 13:54:47.079027
\.


--
-- Data for Name: overtime_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.overtime_rules (id, schedule_type_id, overtime_type, grace_period_minutes, min_overtime_minutes, max_overtime_hours, rate_multiplier, created_at, updated_at) FROM stdin;
1	1	immediate	0	60	4.0	1.5	2026-04-12 09:45:18.043922	2026-04-12 09:47:21.606895
2	2	immediate	0	30	4.0	1.5	2026-04-12 09:47:13.207676	2026-04-18 12:00:28.58405
\.


--
-- Data for Name: payroll_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_items (id, payroll_run_id, user_id, basic_salary, transport_allowance, meal_allowance, overtime_hours, overtime_amount, bpjs_kes_employee, bpjs_kes_company, bpjs_jht_employee, bpjs_jht_company, bpjs_jp_employee, bpjs_jp_company, bpjs_jkk, bpjs_jkm, gross_income, pph21_amount, loan_deduction, total_deductions, net_salary, created_at, salary_type, working_days, driver_subuh_days, driver_subuh_amount, driver_rit_total, driver_rit_amount, driver_overnight_days, driver_overnight_amount, driver_total_allowance, driver_extra_rit, driver_ritase_amount) FROM stdin;
96	6	224	6000000.00	3000000.00	1000000.00	0.0	0.00	60000.00	240000.00	120000.00	222000.00	60000.00	120000.00	14400.00	18000.00	10000000.00	298000.00	0.00	538000.00	9462000.00	2026-04-13 13:12:35.346842	monthly	22	0	0	0	0	0	0	0	0	0
98	6	217	5000000.00	100000.00	400000.00	0.0	0.00	50000.00	200000.00	100000.00	185000.00	50000.00	100000.00	12000.00	15000.00	5500000.00	42500.00	0.00	242500.00	5257500.00	2026-04-13 13:12:35.346842	monthly	22	0	0	0	0	0	0	0	0	0
99	6	223	7000000.00	2000000.00	2500000.00	0.0	0.00	70000.00	280000.00	140000.00	259000.00	70000.00	140000.00	16800.00	21000.00	11500000.00	518500.00	0.00	798500.00	10701500.00	2026-04-13 13:12:35.346842	monthly	22	0	0	0	0	0	0	0	0	0
100	6	225	5500000.00	2000000.00	200000.00	0.0	0.00	55000.00	220000.00	110000.00	203500.00	55000.00	110000.00	13200.00	16500.00	7700000.00	151750.00	0.00	371750.00	7328250.00	2026-04-13 13:12:35.346842	monthly	22	0	0	0	0	0	0	0	0	0
\.


--
-- Data for Name: payroll_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_runs (id, period_month, period_year, run_date, status, created_by, notes, created_at, updated_at) FROM stdin;
5	3	2026	2026-03-05	finalized	1	\N	2026-03-05 15:17:12.58583	2026-03-06 13:47:58.116098
6	4	2026	2026-04-13	draft	1	\N	2026-04-13 13:12:35.346842	2026-04-13 13:12:35.346842
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.positions (id, name, description, created_at, updated_at) FROM stdin;
1	Staf		2026-04-12 01:38:29.864477	2026-04-12 01:38:29.864477
3	Driver		2026-04-15 13:21:42.968401	2026-04-15 13:21:42.968401
4	Produksi		2026-04-15 13:21:49.312568	2026-04-15 13:21:49.312568
5	Manager		2026-04-15 13:21:55.607042	2026-04-15 13:21:55.607042
6	Admin Gudang		2026-04-15 13:22:01.822114	2026-04-15 13:22:01.822114
7	Colector		2026-04-16 14:34:11.543332	2026-04-16 14:34:11.543332
\.


--
-- Data for Name: recruitment_stages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recruitment_stages (id, candidate_id, stage_name, stage_order, status, scheduled_date, completed_date, interviewer_id, score, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.settings (id, key, value, updated_at) FROM stdin;
1	app_logo	/uploads/logo/logo-1776417248528.png	2026-02-10 15:16:43.301269
\.


--
-- Data for Name: user_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_locations (user_id, location_id, created_at) FROM stdin;
241	3	2026-04-16 15:06:11.131117
217	3	2026-04-17 13:36:24.117581
\.


--
-- Data for Name: user_off_days; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_off_days (id, user_id, off_date, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, employee_id, name, email, password, role, face_descriptor, created_at, off_day) FROM stdin;
242	Driver2	Edi	\N	$2b$10$5xsWDlxicQI2t34NZY5Bb.61qym/J0qRpvPB.oB9uc1MrCfocUsUS	employee	\N	2026-04-14 13:37:11.94224	Minggu
243	Driver3	Sibu	\N	$2b$10$z2eTJGvoKugPJdp9dDOfx.W45kPaULf9AhPz1aKZL/cTTPyHnaOhO	employee	\N	2026-04-14 13:37:25.395776	Minggu
1	ADMIN001	Administrator	admin@company.com	$2b$10$FykKDMBSLLr.74V5Z6GHhuQaX.WxKJIpmtW3RbaoKtOip11Fg60c.	admin	[-0.08880606293678284,0.13460969924926758,0.07433364540338516,-0.05915689468383789,0.01799844577908516,-0.03882849961519241,0.002958257682621479,-0.15677589178085327,0.18371345102787018,-0.14121901988983154,0.23854206502437592,0.02107934281229973,-0.16860802471637726,-0.1308172345161438,0.0268856193870306,0.1534385085105896,-0.12183406203985214,-0.16686739027500153,-0.14401787519454956,-0.0015719830989837646,-0.03484451770782471,0.016698651015758514,0.015424210578203201,0.008298472501337528,-0.027679484337568283,-0.3446823060512543,-0.0923272967338562,-0.08651765435934067,0.0015127693768590689,-0.010914042592048645,-0.001523000537417829,0.05482509732246399,-0.15138739347457886,-0.03392584249377251,0.03672018647193909,0.1398397535085678,-0.08584228903055191,-0.004878183361142874,0.24303334951400757,-0.008886896073818207,-0.18229928612709045,-0.027625031769275665,0.034465909004211426,0.24791084229946136,0.26051947474479675,0.009988862089812756,0.024216722697019577,-0.06474439054727554,0.10150567442178726,-0.20356710255146027,0.0208056028932333,0.12453357130289078,0.11898533254861832,0.09202045202255249,0.07711713016033173,-0.11434317380189896,0.03171650320291519,0.052812449634075165,-0.15097275376319885,-0.010088501498103142,0.019905582070350647,-0.19195552170276642,-0.07538137584924698,0.04506045952439308,0.24910110235214233,0.07769572734832764,-0.11999714374542236,-0.12165388464927673,0.17845453321933746,-0.14670242369174957,-0.04740339145064354,0.06522438675165176,-0.13667431473731995,-0.1375056952238083,-0.2691139578819275,0.03643513470888138,0.4983075261116028,0.09259919822216034,-0.18845777213573456,0.043531086295843124,-0.081633061170578,-0.07145144045352936,0.08651699125766754,0.11187577992677689,-0.057437531650066376,-0.03723420202732086,-0.12248189002275467,0.0019945716485381126,0.2179621458053589,-0.030741805210709572,-0.05632687732577324,0.14530177414417267,-0.04072772338986397,0.05493207648396492,0.01380177028477192,-0.012912008911371231,-0.018217360600829124,-0.006505751051008701,-0.15600845217704773,-0.08474300801753998,0.039926156401634216,-0.03865806385874748,-0.013858484104275703,0.10071808099746704,-0.14588606357574463,0.13565580546855927,0.029851986095309258,0.016627395525574684,0.044808369129896164,0.01950705796480179,-0.0875297263264656,-0.07885141670703888,0.14720657467842102,-0.1768491417169571,0.18175356090068817,0.14371958374977112,-0.029498344287276268,0.12519028782844543,0.10104344040155411,0.10742931813001633,0.0001507113775005564,-0.014336821623146534,-0.164251446723938,-0.06842709332704544,0.0426170639693737,0.08597570657730103,0.1280507743358612,0.013848718255758286]	2026-02-07 15:10:42.527021	Minggu
244	Driver4	Firli	\N	$2b$10$0.Dqs4rtR9KSxCeHR5pNfeEE3hPJPAI.EPHTeoEjGMMb4te0/gR/i	employee	\N	2026-04-14 13:37:41.93956	Minggu
217	AW01	Wisnu wong	\N	$2b$10$DzH5Q0mcsmfK4.bAU6TMRuh2I4g9bLJzmJmOOBqNyjMNuB.7vQlN.	employee	\N	2026-04-12 09:48:49.757154	Minggu
223	AW02	Wisnu2	\N	$2b$10$nPpzAnmtvTkYrPn2wbHAoe1v.WOrU3Z/Q17aDHz8Hrn4MmF0.0tci	employee	\N	2026-04-12 13:46:04.028272	Minggu
224	AW03	wisnu3	\N	$2b$10$h/11dX3yRMHEFlt8dAoqyeqxuiGItfKrBWg9GtkJyH3Qz8E4GSAp2	employee	[-0.04499084874987602,0.11053664237260818,0.09900103509426117,-0.02979152649641037,0.019047100096940994,-0.03833073377609253,-0.03126583620905876,-0.1343184858560562,0.15759217739105225,-0.158145010471344,0.2616753578186035,0.0000071424101406591944,-0.11850101500749588,-0.1716156303882599,0.018933121114969254,0.1641654521226883,-0.08152405172586441,-0.1992301344871521,-0.09993282705545425,-0.009828073903918266,0.039459891617298126,0.004142000339925289,-0.0016278098337352276,-0.025087937712669373,-0.08354631066322327,-0.343675434589386,-0.1276356279850006,-0.029952658340334892,0.05215887725353241,-0.03140243515372276,-0.04998742789030075,0.052579473704099655,-0.24444346129894257,-0.07550667971372604,0.041097357869148254,0.18508166074752808,-0.0837239921092987,-0.01700689271092415,0.1623736023902893,0.028113391250371933,-0.2011551409959793,0.005932603031396866,0.038882624357938766,0.2655194401741028,0.2580641210079193,0.05910661071538925,0.021482760086655617,-0.10980274528265,0.10244397819042206,-0.16093192994594574,0.09549610316753387,0.1197621151804924,0.15665490925312042,0.1540461629629135,0.06621778756380081,-0.10698696225881577,0.07197128981351852,0.0911654457449913,-0.1728564202785492,-0.03859226033091545,0.03682469204068184,-0.09590747207403183,-0.03749071806669235,-0.004136090166866779,0.25071531534194946,0.08122750371694565,-0.10957405716180801,-0.16108527779579163,0.18199394643306732,-0.12796323001384735,-0.04913899675011635,0.1139092966914177,-0.14480072259902954,-0.12190282344818115,-0.339710533618927,0.04617748036980629,0.47887617349624634,0.07115903496742249,-0.1787080317735672,0.03194495663046837,-0.021584438160061836,-0.036852795630693436,0.1279551088809967,0.12902769446372986,-0.02684078924357891,0.006852657068520784,-0.08089615404605865,0.02307317405939102,0.22117245197296143,-0.01886511594057083,-0.0855572521686554,0.11240603774785995,-0.0490485243499279,0.06836694478988647,0.012953730300068855,0.03329821676015854,-0.007866871543228626,0.048926759511232376,-0.15623591840267181,-0.05967392399907112,-0.01185772567987442,0.008249364793300629,-0.056171517819166183,0.13018058240413666,-0.12372832745313644,0.16903282701969147,0.04112686589360237,0.041389480233192444,0.007403629366308451,-0.02414519339799881,-0.09109985083341599,-0.05071902275085449,0.0776592269539833,-0.26540595293045044,0.1946500539779663,0.1554306149482727,-0.023031415417790413,0.09709018468856812,0.09841033071279526,0.10171407461166382,0.009262118488550186,-0.06891913712024689,-0.2329529970884323,-0.03861188888549805,0.055025435984134674,0.018219683319330215,0.10668474435806274,0.012055585160851479]	2026-04-12 13:46:54.188682	Minggu
225	AW04	wisnu4	\N	$2b$10$rg5IwF0Mfysi9P7B0LXNXuWbNRulv4wWY42AuYSH3TSrDLXXP/Viq	employee	\N	2026-04-12 13:47:30.936663	Minggu
274	Col1	Widi	\N	$2b$10$xL7arXUCfIPJztGMxoXtRu4NPuCv5Xr9q3bE3X.gft8HiHUsx/8L2	employee	\N	2026-04-16 14:34:41.185021	Minggu
275	Col2	Mono	\N	$2b$10$cH3pKOPD4zFVEPkotcC.Lufn1oFYAZEO5xgf/BFCfRPjCgPoNvqKS	employee	\N	2026-04-16 14:34:51.678643	Minggu
241	Driver1	Asrul	\N	$2b$10$Tqo9v.9D2QrkQlql/SUe5OK.gZZ1KDKln6AQtRAHZVuNwNOQgUTmy	employee	[-0.03476694971323013,0.13307684659957886,0.08680635690689087,-0.05241548269987106,0.0002180182927986607,0.004189283587038517,0.01687614992260933,-0.18478018045425415,0.2098948210477829,-0.13674692809581757,0.1973523050546646,0.045945487916469574,-0.1543719321489334,-0.09769348800182343,0.023347873240709305,0.1660868525505066,-0.12123609334230423,-0.18959088623523712,-0.12613727152347565,-0.05370130017399788,-0.03750814497470856,0.004530285019427538,0.055495165288448334,-0.013410271145403385,-0.05918119102716446,-0.3437598943710327,-0.08795231580734253,-0.0574585497379303,0.07908402383327484,0.028281692415475845,0.012123343534767628,0.08143910020589828,-0.20166350901126862,-0.0423155277967453,0.025350296869874,0.16609351336956024,-0.08448056131601334,-0.01684454269707203,0.2322177141904831,-0.009089253842830658,-0.17777538299560547,-0.021864978596568108,0.0498322919011116,0.24663904309272766,0.24348412454128265,0.01182103343307972,0.04502365365624428,-0.09411175549030304,0.06929723918437958,-0.20579148828983307,0.02163013070821762,0.10667101293802261,0.06871045380830765,0.08989941328763962,0.08740638196468353,-0.11782099306583405,0.0395931676030159,0.07308194786310196,-0.16218706965446472,-0.003942748997360468,0.017706478014588356,-0.16080519556999207,-0.06519575417041779,-0.014386317692697048,0.2620660662651062,0.0683373510837555,-0.0751284509897232,-0.12319260090589523,0.18468859791755676,-0.13050466775894165,-0.04629501700401306,0.06306304037570953,-0.12166023254394531,-0.10705960541963577,-0.3167039155960083,0.0008080730913206935,0.4808276891708374,0.09213080257177353,-0.1333230882883072,0.08824422210454941,-0.0589275099337101,-0.0493941493332386,0.11380195617675781,0.0937352403998375,-0.04443662613630295,-0.01842258684337139,-0.09118594229221344,0.040117233991622925,0.21480698883533478,-0.04877519980072975,-0.05146334692835808,0.1320783942937851,-0.054804421961307526,0.05841658264398575,-0.01815975271165371,0.015689078718423843,-0.04164480045437813,0.04029439762234688,-0.20825985074043274,-0.08532988280057907,0.03389233350753784,0.014028079807758331,0.032223302870988846,0.10170899331569672,-0.17290441691875458,0.10464539378881454,0.03576333075761795,-0.0033074647653847933,0.06915830075740814,-0.004866786766797304,-0.10846580564975739,-0.06902523338794708,0.1725234091281891,-0.2288612425327301,0.18794244527816772,0.188888818025589,-0.07087437808513641,0.11259157210588455,0.11133980005979538,0.09244372695684433,0.0009444336756132543,-0.030609821900725365,-0.19480685889720917,-0.02420627698302269,0.051641419529914856,0.02528814785182476,0.08996284008026123,0.044269368052482605]	2026-04-14 13:36:45.897251	Minggu
\.


--
-- Data for Name: work_schedule_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_schedule_types (id, name, type, shift_count, department, is_default, is_active, created_at, updated_at, "position") FROM stdin;
1	Normal	normal	1	Finance	f	t	2026-04-12 09:45:18.043922	2026-04-12 09:47:21.606895	\N
2	Shift1	shift	3	Gudang	f	t	2026-04-12 09:47:13.207676	2026-04-18 12:00:28.58405	Driver
\.


--
-- Data for Name: work_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_shifts (id, schedule_type_id, name, shift_order, start_time, end_time, break_start, break_end, is_overnight, color, created_at) FROM stdin;
5	1	Normal	1	08:00:00	17:00:00	12:00:00	13:00:00	f	#3b82f6	2026-04-12 09:47:21.606895
12	2	Shift Pagi	1	06:00:00	14:00:00	12:00:00	13:00:00	f	#3b82f6	2026-04-18 12:00:28.58405
13	2	Shift Siang	2	14:00:00	22:00:00	18:00:00	19:00:00	f	#10b981	2026-04-18 12:00:28.58405
14	2	Shift Malam	3	22:00:00	06:00:00	02:00:00	03:00:00	f	#f59e0b	2026-04-18 12:00:28.58405
\.


--
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcements_id_seq', 2, true);


--
-- Name: asset_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asset_assignments_id_seq', 1, false);


--
-- Name: asset_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asset_categories_id_seq', 3, true);


--
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.assets_id_seq', 1, false);


--
-- Name: attendance_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_locations_id_seq', 3, true);


--
-- Name: attendance_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_records_id_seq', 200, true);


--
-- Name: bpjs_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bpjs_settings_id_seq', 310, true);


--
-- Name: candidates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.candidates_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 10, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.departments_id_seq', 9, true);


--
-- Name: discipline_assessments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.discipline_assessments_id_seq', 1, false);


--
-- Name: driver_activities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.driver_activities_id_seq', 1, false);


--
-- Name: driver_tracking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.driver_tracking_id_seq', 10, true);


--
-- Name: employee_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_details_id_seq', 71, true);


--
-- Name: employee_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_documents_id_seq', 1, false);


--
-- Name: employee_loans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_loans_id_seq', 1, true);


--
-- Name: employee_shift_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_shift_assignments_id_seq', 11, true);


--
-- Name: interviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.interviews_id_seq', 1, false);


--
-- Name: job_positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.job_positions_id_seq', 1, false);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 4, true);


--
-- Name: license_info_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.license_info_id_seq', 1, true);


--
-- Name: loan_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.loan_payments_id_seq', 1, false);


--
-- Name: overtime_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_records_id_seq', 1, true);


--
-- Name: overtime_request_employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_request_employees_id_seq', 2, true);


--
-- Name: overtime_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_requests_id_seq', 2, true);


--
-- Name: overtime_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_rules_id_seq', 6, true);


--
-- Name: payroll_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_items_id_seq', 100, true);


--
-- Name: payroll_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_runs_id_seq', 6, true);


--
-- Name: positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.positions_id_seq', 7, true);


--
-- Name: recruitment_stages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recruitment_stages_id_seq', 1, false);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.settings_id_seq', 1, true);


--
-- Name: user_off_days_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_off_days_id_seq', 12, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 301, true);


--
-- Name: work_schedule_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_schedule_types_id_seq', 2, true);


--
-- Name: work_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_shifts_id_seq', 14, true);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: asset_assignments asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_categories asset_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_name_key UNIQUE (name);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);


--
-- Name: assets assets_asset_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_code_key UNIQUE (asset_code);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: attendance_locations attendance_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_locations
    ADD CONSTRAINT attendance_locations_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: bpjs_settings bpjs_settings_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bpjs_settings
    ADD CONSTRAINT bpjs_settings_code_key UNIQUE (code);


--
-- Name: bpjs_settings bpjs_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bpjs_settings
    ADD CONSTRAINT bpjs_settings_pkey PRIMARY KEY (id);


--
-- Name: candidates candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);


--
-- Name: customers customers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_name_key UNIQUE (name);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: discipline_assessments discipline_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discipline_assessments
    ADD CONSTRAINT discipline_assessments_pkey PRIMARY KEY (id);


--
-- Name: discipline_assessments discipline_assessments_user_id_period_month_period_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discipline_assessments
    ADD CONSTRAINT discipline_assessments_user_id_period_month_period_year_key UNIQUE (user_id, period_month, period_year);


--
-- Name: driver_activities driver_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_activities
    ADD CONSTRAINT driver_activities_pkey PRIMARY KEY (id);


--
-- Name: driver_activities driver_activities_user_id_activity_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_activities
    ADD CONSTRAINT driver_activities_user_id_activity_date_key UNIQUE (user_id, activity_date);


--
-- Name: driver_tracking driver_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_tracking
    ADD CONSTRAINT driver_tracking_pkey PRIMARY KEY (id);


--
-- Name: employee_details employee_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_pkey PRIMARY KEY (id);


--
-- Name: employee_details employee_details_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_user_id_key UNIQUE (user_id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_loans employee_loans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_pkey PRIMARY KEY (id);


--
-- Name: employee_shift_assignments employee_shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shift_assignments
    ADD CONSTRAINT employee_shift_assignments_pkey PRIMARY KEY (id);


--
-- Name: employee_shift_assignments employee_shift_assignments_user_id_assignment_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shift_assignments
    ADD CONSTRAINT employee_shift_assignments_user_id_assignment_date_key UNIQUE (user_id, assignment_date);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: job_positions job_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_positions
    ADD CONSTRAINT job_positions_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: license_info license_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.license_info
    ADD CONSTRAINT license_info_pkey PRIMARY KEY (id);


--
-- Name: loan_payments loan_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_pkey PRIMARY KEY (id);


--
-- Name: overtime_records overtime_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_records
    ADD CONSTRAINT overtime_records_pkey PRIMARY KEY (id);


--
-- Name: overtime_request_employees overtime_request_employees_overtime_request_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_request_employees
    ADD CONSTRAINT overtime_request_employees_overtime_request_id_user_id_key UNIQUE (overtime_request_id, user_id);


--
-- Name: overtime_request_employees overtime_request_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_request_employees
    ADD CONSTRAINT overtime_request_employees_pkey PRIMARY KEY (id);


--
-- Name: overtime_requests overtime_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_pkey PRIMARY KEY (id);


--
-- Name: overtime_requests overtime_requests_spl_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_spl_number_key UNIQUE (spl_number);


--
-- Name: overtime_rules overtime_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_rules
    ADD CONSTRAINT overtime_rules_pkey PRIMARY KEY (id);


--
-- Name: overtime_rules overtime_rules_schedule_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_rules
    ADD CONSTRAINT overtime_rules_schedule_type_id_key UNIQUE (schedule_type_id);


--
-- Name: payroll_items payroll_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_pkey PRIMARY KEY (id);


--
-- Name: payroll_runs payroll_runs_period_month_period_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_period_month_period_year_key UNIQUE (period_month, period_year);


--
-- Name: payroll_runs payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);


--
-- Name: positions positions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_name_key UNIQUE (name);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: recruitment_stages recruitment_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_stages
    ADD CONSTRAINT recruitment_stages_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_key UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: user_locations user_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_pkey PRIMARY KEY (user_id, location_id);


--
-- Name: user_off_days user_off_days_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_off_days
    ADD CONSTRAINT user_off_days_pkey PRIMARY KEY (id);


--
-- Name: user_off_days user_off_days_user_id_off_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_off_days
    ADD CONSTRAINT user_off_days_user_id_off_date_key UNIQUE (user_id, off_date);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_schedule_types work_schedule_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_schedule_types
    ADD CONSTRAINT work_schedule_types_pkey PRIMARY KEY (id);


--
-- Name: work_shifts work_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id);


--
-- Name: idx_announcements_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcements_active ON public.announcements USING btree (is_active);


--
-- Name: idx_announcements_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at);


--
-- Name: idx_assessment_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assessment_period ON public.discipline_assessments USING btree (period_year, period_month);


--
-- Name: idx_assessment_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assessment_user ON public.discipline_assessments USING btree (user_id);


--
-- Name: idx_attendance_recorded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_recorded_at ON public.attendance_records USING btree (recorded_at);


--
-- Name: idx_attendance_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_type ON public.attendance_records USING btree (type);


--
-- Name: idx_attendance_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_user_id ON public.attendance_records USING btree (user_id);


--
-- Name: idx_candidate_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_position ON public.candidates USING btree (applied_position_id);


--
-- Name: idx_candidate_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_status ON public.candidates USING btree (status);


--
-- Name: idx_customers_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_active ON public.customers USING btree (is_active);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_driver_tracking_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_driver_tracking_date ON public.driver_tracking USING btree (tracking_date);


--
-- Name: idx_driver_tracking_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_driver_tracking_status ON public.driver_tracking USING btree (status);


--
-- Name: idx_driver_tracking_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_driver_tracking_type ON public.driver_tracking USING btree (tracking_type);


--
-- Name: idx_driver_tracking_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_driver_tracking_user ON public.driver_tracking USING btree (user_id);


--
-- Name: idx_emp_detail_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emp_detail_user ON public.employee_details USING btree (user_id);


--
-- Name: idx_employee_documents_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_user_id ON public.employee_documents USING btree (user_id);


--
-- Name: idx_esa_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_esa_date ON public.employee_shift_assignments USING btree (assignment_date);


--
-- Name: idx_esa_shift; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_esa_shift ON public.employee_shift_assignments USING btree (shift_id);


--
-- Name: idx_esa_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_esa_user ON public.employee_shift_assignments USING btree (user_id);


--
-- Name: idx_interview_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_candidate ON public.interviews USING btree (candidate_id);


--
-- Name: idx_interview_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_date ON public.interviews USING btree (interview_date);


--
-- Name: idx_interview_interviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interview_interviewer ON public.interviews USING btree (interviewer_id);


--
-- Name: idx_job_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_status ON public.job_positions USING btree (status);


--
-- Name: idx_leave_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_date ON public.leave_requests USING btree (start_date);


--
-- Name: idx_leave_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_user_id ON public.leave_requests USING btree (user_id);


--
-- Name: idx_loan_payment_loan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_loan_payment_loan ON public.loan_payments USING btree (loan_id);


--
-- Name: idx_loan_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_loan_status ON public.employee_loans USING btree (status);


--
-- Name: idx_loan_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_loan_user ON public.employee_loans USING btree (user_id);


--
-- Name: idx_off_days_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_off_days_date ON public.user_off_days USING btree (off_date);


--
-- Name: idx_off_days_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_off_days_user_id ON public.user_off_days USING btree (user_id);


--
-- Name: idx_ore_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ore_request ON public.overtime_request_employees USING btree (overtime_request_id);


--
-- Name: idx_ore_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ore_user ON public.overtime_request_employees USING btree (user_id);


--
-- Name: idx_otr_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otr_date ON public.overtime_requests USING btree (date);


--
-- Name: idx_otr_dept; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otr_dept ON public.overtime_requests USING btree (department);


--
-- Name: idx_otr_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otr_status ON public.overtime_requests USING btree (status);


--
-- Name: idx_overtime_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_overtime_date ON public.overtime_records USING btree (date);


--
-- Name: idx_overtime_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_overtime_status ON public.overtime_records USING btree (status);


--
-- Name: idx_overtime_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_overtime_user ON public.overtime_records USING btree (user_id);


--
-- Name: idx_payroll_item_run; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payroll_item_run ON public.payroll_items USING btree (payroll_run_id);


--
-- Name: idx_payroll_item_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payroll_item_user ON public.payroll_items USING btree (user_id);


--
-- Name: idx_stage_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stage_candidate ON public.recruitment_stages USING btree (candidate_id);


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_returned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_returned_to_fkey FOREIGN KEY (returned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assets assets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE SET NULL;


--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assets assets_current_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_current_assignee_id_fkey FOREIGN KEY (current_assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_records attendance_records_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.attendance_locations(id) ON DELETE SET NULL;


--
-- Name: attendance_records attendance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bpjs_settings bpjs_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bpjs_settings
    ADD CONSTRAINT bpjs_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: candidates candidates_applied_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_applied_position_id_fkey FOREIGN KEY (applied_position_id) REFERENCES public.job_positions(id) ON DELETE SET NULL;


--
-- Name: discipline_assessments discipline_assessments_assessed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discipline_assessments
    ADD CONSTRAINT discipline_assessments_assessed_by_fkey FOREIGN KEY (assessed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: discipline_assessments discipline_assessments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.discipline_assessments
    ADD CONSTRAINT discipline_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: driver_activities driver_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_activities
    ADD CONSTRAINT driver_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: driver_activities driver_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_activities
    ADD CONSTRAINT driver_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: driver_tracking driver_tracking_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_tracking
    ADD CONSTRAINT driver_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_details employee_details_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_loans employee_loans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_loans employee_loans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_loans
    ADD CONSTRAINT employee_loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_shift_assignments employee_shift_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shift_assignments
    ADD CONSTRAINT employee_shift_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_shift_assignments employee_shift_assignments_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shift_assignments
    ADD CONSTRAINT employee_shift_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id) ON DELETE CASCADE;


--
-- Name: employee_shift_assignments employee_shift_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shift_assignments
    ADD CONSTRAINT employee_shift_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_interviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_interviewer_id_fkey FOREIGN KEY (interviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: interviews interviews_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.recruitment_stages(id) ON DELETE SET NULL;


--
-- Name: job_positions job_positions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_positions
    ADD CONSTRAINT job_positions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: loan_payments loan_payments_loan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_payments
    ADD CONSTRAINT loan_payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.employee_loans(id) ON DELETE CASCADE;


--
-- Name: overtime_records overtime_records_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_records
    ADD CONSTRAINT overtime_records_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_records overtime_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_records
    ADD CONSTRAINT overtime_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: overtime_request_employees overtime_request_employees_overtime_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_request_employees
    ADD CONSTRAINT overtime_request_employees_overtime_request_id_fkey FOREIGN KEY (overtime_request_id) REFERENCES public.overtime_requests(id) ON DELETE CASCADE;


--
-- Name: overtime_request_employees overtime_request_employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_request_employees
    ADD CONSTRAINT overtime_request_employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: overtime_requests overtime_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_requests overtime_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: overtime_requests overtime_requests_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shifts(id) ON DELETE SET NULL;


--
-- Name: overtime_rules overtime_rules_schedule_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.overtime_rules
    ADD CONSTRAINT overtime_rules_schedule_type_id_fkey FOREIGN KEY (schedule_type_id) REFERENCES public.work_schedule_types(id) ON DELETE CASCADE;


--
-- Name: payroll_items payroll_items_payroll_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;


--
-- Name: payroll_items payroll_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_items
    ADD CONSTRAINT payroll_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payroll_runs payroll_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT payroll_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: recruitment_stages recruitment_stages_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_stages
    ADD CONSTRAINT recruitment_stages_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: recruitment_stages recruitment_stages_interviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_stages
    ADD CONSTRAINT recruitment_stages_interviewer_id_fkey FOREIGN KEY (interviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_locations user_locations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.attendance_locations(id) ON DELETE CASCADE;


--
-- Name: user_locations user_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_locations
    ADD CONSTRAINT user_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_off_days user_off_days_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_off_days
    ADD CONSTRAINT user_off_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_shifts work_shifts_schedule_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_shifts
    ADD CONSTRAINT work_shifts_schedule_type_id_fkey FOREIGN KEY (schedule_type_id) REFERENCES public.work_schedule_types(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict n9LsEbhr0zOPG0Wb1fWKfgjgzvjo44kWsGLxo3JDC3d6CTOgBqLfvj0OdarWC0d

