--
-- PostgreSQL database dump
--

\restrict cS0CPjUFngr3qVaTj34hYb916AyB80cqYofa8n20x04Chnbhoa8jc4NtzRAdaCg

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
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_settings OWNER TO postgres;

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
    CONSTRAINT attendance_records_type_check CHECK (((type)::text = ANY ((ARRAY['check_in'::character varying, 'check_out'::character varying])::text[])))
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
    customer_code character varying(50),
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
    salary_type character varying(10) DEFAULT 'monthly'::character varying,
    transport_allowance numeric(15,2) DEFAULT 0,
    meal_allowance numeric(15,2) DEFAULT 0,
    overtime_rate numeric(15,2) DEFAULT 50000,
    tax_status character varying(10) DEFAULT 'TK/0'::character varying,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_driver boolean DEFAULT false,
    driver_subuh_allowance numeric DEFAULT 0,
    driver_rit_allowance numeric DEFAULT 0,
    driver_inap_allowance numeric DEFAULT 0,
    vehicle_type_id integer,
    is_collector boolean DEFAULT false,
    use_tracking boolean DEFAULT false,
    driver_ritase_allowance numeric DEFAULT 0,
    bpjs_kes_enrolled boolean DEFAULT true,
    bpjs_jht_enrolled boolean DEFAULT true,
    bpjs_jp_enrolled boolean DEFAULT true,
    bpjs_jkk_enrolled boolean DEFAULT true,
    bpjs_jkm_enrolled boolean DEFAULT true,
    pph21_enabled boolean DEFAULT true,
    bpjs_kes_employee_rate numeric(6,4),
    bpjs_kes_company_rate numeric(6,4),
    bpjs_jht_employee_rate numeric(6,4),
    bpjs_jht_company_rate numeric(6,4),
    bpjs_jp_employee_rate numeric(6,4),
    bpjs_jp_company_rate numeric(6,4),
    bpjs_jkk_rate numeric(6,4),
    bpjs_jkm_rate numeric(6,4),
    CONSTRAINT employee_details_gender_check CHECK (((gender)::text = ANY ((ARRAY['Laki-laki'::character varying, 'Perempuan'::character varying])::text[]))),
    CONSTRAINT employee_details_marital_status_check CHECK (((marital_status)::text = ANY ((ARRAY['Belum Menikah'::character varying, 'Menikah'::character varying, 'Cerai'::character varying])::text[]))),
    CONSTRAINT employee_details_salary_type_check CHECK (((salary_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[])))
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
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
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
    salary_type character varying(10) DEFAULT 'monthly'::character varying,
    working_days integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    face_descriptor text,
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
-- Name: vehicle_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_types (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.vehicle_types OWNER TO postgres;

--
-- Name: vehicle_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.vehicle_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_types_id_seq OWNER TO postgres;

--
-- Name: vehicle_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.vehicle_types_id_seq OWNED BY public.vehicle_types.id;


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
-- Name: employee_details id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details ALTER COLUMN id SET DEFAULT nextval('public.employee_details_id_seq'::regclass);


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
-- Name: vehicle_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types ALTER COLUMN id SET DEFAULT nextval('public.vehicle_types_id_seq'::regclass);


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
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (key, value, updated_at) FROM stdin;
customer_code_prefix	CUST	2026-05-05 17:01:19.456668
customer_code_next	1	2026-05-05 17:01:19.456668
customer_code_digits	4	2026-05-05 17:01:19.456668
\.


--
-- Data for Name: attendance_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_locations (id, name, latitude, longitude, radius_meters, is_active, created_at) FROM stdin;
6	Rumah Wisnu	-6.20880000	106.84560000	100	t	2026-02-07 09:00:04.768548
7	Kantor SJS	-6.14009986	106.77778839	100	t	2026-02-07 09:59:31.983491
8	Kantor Pusat	-6.20880000	106.84560000	100	t	2026-02-07 10:25:10.795074
1	Kantor Specta	-6.12643740	106.83208390	100	t	2026-02-09 12:18:22.607178
\.


--
-- Data for Name: attendance_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_records (id, user_id, location_id, type, photo_path, latitude, longitude, distance_meters, is_valid, notes, recorded_at) FROM stdin;
\.


--
-- Data for Name: bpjs_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bpjs_settings (id, code, name, description, employee_rate, company_rate, max_salary_base, is_active, updated_by, created_at, updated_at) FROM stdin;
1	BPJS_KES	BPJS Kesehatan	Jaminan Kesehatan Nasional (JKN)	0.0100	0.0400	12000000.00	t	\N	2026-06-08 11:59:57.918439	2026-06-08 11:59:57.918439
2	BPJS_JHT	BPJS JHT	Jaminan Hari Tua	0.0200	0.0370	\N	t	\N	2026-06-08 11:59:57.918439	2026-06-08 11:59:57.918439
3	BPJS_JP	BPJS JP	Jaminan Pensiun	0.0100	0.0200	10042300.00	t	\N	2026-06-08 11:59:57.918439	2026-06-08 11:59:57.918439
4	BPJS_JKK	BPJS JKK	Jaminan Kecelakaan Kerja (Kelompok I - Risiko Sangat Rendah)	0.0000	0.0024	\N	t	\N	2026-06-08 11:59:57.918439	2026-06-08 11:59:57.918439
5	BPJS_JKM	BPJS JKM	Jaminan Kematian	0.0000	0.0030	\N	t	\N	2026-06-08 11:59:57.918439	2026-06-08 11:59:57.918439
\.


--
-- Data for Name: candidates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.candidates (id, full_name, email, phone, address, education, experience_years, applied_position_id, resume_path, photo_path, status, source, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, customer_code, name, address, phone, notes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, description, created_at, updated_at) FROM stdin;
1	Marketing		2026-04-12 01:14:23.637745	2026-04-12 01:14:23.637745
\.


--
-- Data for Name: discipline_assessments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.discipline_assessments (id, user_id, period_month, period_year, total_working_days, present_days, late_days, absent_days, leave_days, overtime_days, attendance_score, attitude_score, performance_score, final_score, grade, notes, assessed_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employee_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_details (id, user_id, nik, phone, address, birth_date, birth_place, gender, marital_status, religion, education, department, "position", join_date, bank_name, bank_account, bank_holder, npwp, bpjs_kesehatan_no, bpjs_ketenagakerjaan_no, basic_salary, salary_type, transport_allowance, meal_allowance, overtime_rate, tax_status, emergency_contact_name, emergency_contact_phone, created_at, updated_at, is_driver, driver_subuh_allowance, driver_rit_allowance, driver_inap_allowance, vehicle_type_id, is_collector, use_tracking, driver_ritase_allowance, bpjs_kes_enrolled, bpjs_jht_enrolled, bpjs_jp_enrolled, bpjs_jkk_enrolled, bpjs_jkm_enrolled, pph21_enabled, bpjs_kes_employee_rate, bpjs_kes_company_rate, bpjs_jht_employee_rate, bpjs_jht_company_rate, bpjs_jp_employee_rate, bpjs_jp_company_rate, bpjs_jkk_rate, bpjs_jkm_rate) FROM stdin;
1	5	\N	\N	\N	\N	\N	\N	Belum Menikah	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	monthly	0.00	0.00	50000.00	TK/0	\N	\N	2026-04-14 14:33:20.277253	2026-04-14 14:33:20.277253	t	25000	15000	50000	\N	f	f	0	t	t	t	t	t	t	\N	\N	\N	\N	\N	\N	\N	\N
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
1	2	late	2026-02-07	2026-02-07	terlambat karena macet	/uploads/leave/leave-1770435391944-77001654.jpeg	approved	2	\N	2026-02-07 10:36:32.018137	2026-02-07 10:37:12.054092	\N
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
\.


--
-- Data for Name: overtime_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.overtime_requests (id, spl_number, date, shift_id, department, overtime_start, overtime_end, estimated_hours, reason, status, requested_by, approved_by, approved_at, admin_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: overtime_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.overtime_rules (id, schedule_type_id, overtime_type, grace_period_minutes, min_overtime_minutes, max_overtime_hours, rate_multiplier, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payroll_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_items (id, payroll_run_id, user_id, basic_salary, transport_allowance, meal_allowance, overtime_hours, overtime_amount, bpjs_kes_employee, bpjs_kes_company, bpjs_jht_employee, bpjs_jht_company, bpjs_jp_employee, bpjs_jp_company, bpjs_jkk, bpjs_jkm, gross_income, pph21_amount, loan_deduction, total_deductions, net_salary, salary_type, working_days, created_at) FROM stdin;
\.


--
-- Data for Name: payroll_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_runs (id, period_month, period_year, run_date, status, created_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.positions (id, name, description, created_at, updated_at) FROM stdin;
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
2	theme_primary_color	#4C1D95	2026-06-08 13:06:07.946878
3	theme_bg_color	#ededed	2026-06-08 13:06:07.962873
4	theme_card_bg_color	#ffffff	2026-06-08 13:06:07.965171
5	theme_btn_bg_color	#8b5cf6	2026-06-08 13:06:07.966582
1	app_logo	/uploads/logo/logo-1780640959290.png	2026-02-10 14:00:29.834275
10	login_logo	/uploads/logo/logo-1780640967145.png	2026-06-08 13:08:10.872158
11	company_name	Niser Global Indonesia	2026-06-08 13:08:10.874053
\.


--
-- Data for Name: user_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_locations (user_id, location_id, created_at) FROM stdin;
\.


--
-- Data for Name: user_off_days; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_off_days (id, user_id, off_date, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, employee_id, name, email, password, role, created_at, face_descriptor, off_day) FROM stdin;
2	ADMIN001	Administrator	admin@company.com	$2b$10$FykKDMBSLLr.74V5Z6GHhuQaX.WxKJIpmtW3RbaoKtOip11Fg60c.	admin	2026-02-06 21:39:49.1929	[-0.049190323799848557,0.14525482058525085,0.0801643580198288,-0.032262034714221954,0.00828556064516306,0.04145326837897301,0.001247606473043561,-0.16319172084331512,0.2024361491203308,-0.16821536421775818,0.2165132761001587,0.009027140215039253,-0.15651459991931915,-0.11880283057689667,0.08131910860538483,0.17957757413387299,-0.1359454095363617,-0.19459068775177002,-0.1185041144490242,-0.04902445524930954,-0.06077104061841965,0.009681121446192265,0.02279462292790413,0.008066192269325256,-0.08260659873485565,-0.3585420548915863,-0.08094388991594315,-0.08209994435310364,0.0635334700345993,0.003527475520968437,-0.08132734894752502,0.09811314195394516,-0.16909253597259521,-0.053523123264312744,0.049128253012895584,0.19688065350055695,-0.09353174269199371,-0.044996149837970734,0.19892264902591705,-0.016936756670475006,-0.15011583268642426,-0.027708634734153748,0.03520357981324196,0.2411266714334488,0.24930047988891602,0.01983685791492462,0.01653323881328106,-0.06269649416208267,0.08489328622817993,-0.2051408290863037,0.017977934330701828,0.10496948659420013,0.10198389738798141,0.1277642548084259,0.06358782947063446,-0.14491495490074158,0.05710594356060028,0.04910733550786972,-0.12923482060432434,-0.000446224381448701,0.024669213220477104,-0.21231761574745178,-0.05402267351746559,0.01719825156033039,0.26965776085853577,0.09304270893335342,-0.08535104244947433,-0.12386088818311691,0.1435832977294922,-0.10618496686220169,-0.06160951778292656,0.04866281524300575,-0.1399158388376236,-0.12574802339076996,-0.2860446572303772,0.021032186225056648,0.4583244323730469,0.12929029762744904,-0.2007904350757599,0.03871260583400726,-0.02482719160616398,-0.03467187285423279,0.14884115755558014,0.14107352495193481,-0.042015984654426575,-0.06540454179048538,-0.12441329658031464,0.019728200510144234,0.22216103971004486,-0.0326080285012722,-0.0688786581158638,0.12719164788722992,-0.06728757172822952,0.09454557299613953,-0.0007914270390756428,0.007293702568858862,-0.04162168875336647,0.029833225533366203,-0.1735088974237442,-0.09699796140193939,0.06743043661117554,0.006495719775557518,-0.01742386817932129,0.13218407332897186,-0.14708271622657776,0.13543903827667236,0.0183437280356884,0.03272021561861038,0.08341743797063828,-0.016018996015191078,-0.09175509214401245,-0.04165859520435333,0.15933118760585785,-0.20880892872810364,0.16720892488956451,0.1906699240207672,-0.059488967061042786,0.13323064148426056,0.11940938979387283,0.10063206404447556,0.004238797351717949,-0.028463248163461685,-0.23661445081233978,-0.05044923350214958,0.07323010265827179,0.04037640243768692,0.09640644490718842,0.023002412170171738]	Minggu
5	K002	Tri Mulyani	jr.solusindo@gmail.com	$2b$10$v9hmVw9rZaCFRlrL1USj9.wKhRiDjMTinGAwy1vloRQuueoPWKaLS	employee	2026-02-06 21:54:39.142269	\N	Minggu
3	K001	Wisnu Wardana	jagatrayasolusindo@gmail.com	$2b$10$ibNwFGCZhkvxf59hEvUu6eawG5zyGWsRqM8Kqmlse5A5wvRcUYk0O	employee	2026-02-06 21:51:03.720372	\N	Minggu
\.


--
-- Data for Name: vehicle_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle_types (id, name, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_schedule_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_schedule_types (id, name, type, shift_count, department, is_default, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_shifts (id, schedule_type_id, name, shift_order, start_time, end_time, break_start, break_end, is_overnight, color, created_at) FROM stdin;
\.


--
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcements_id_seq', 1, true);


--
-- Name: attendance_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_locations_id_seq', 1, true);


--
-- Name: attendance_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_records_id_seq', 193, true);


--
-- Name: bpjs_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bpjs_settings_id_seq', 40, true);


--
-- Name: candidates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.candidates_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 1, false);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.departments_id_seq', 2, true);


--
-- Name: discipline_assessments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.discipline_assessments_id_seq', 1, false);


--
-- Name: employee_details_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_details_id_seq', 1, true);


--
-- Name: employee_loans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_loans_id_seq', 1, false);


--
-- Name: employee_shift_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_shift_assignments_id_seq', 1, false);


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

SELECT pg_catalog.setval('public.leave_requests_id_seq', 3, true);


--
-- Name: loan_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.loan_payments_id_seq', 1, false);


--
-- Name: overtime_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_records_id_seq', 1, false);


--
-- Name: overtime_request_employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_request_employees_id_seq', 1, false);


--
-- Name: overtime_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_requests_id_seq', 1, false);


--
-- Name: overtime_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.overtime_rules_id_seq', 1, false);


--
-- Name: payroll_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_items_id_seq', 1, false);


--
-- Name: payroll_runs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payroll_runs_id_seq', 1, false);


--
-- Name: positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.positions_id_seq', 1, false);


--
-- Name: recruitment_stages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recruitment_stages_id_seq', 1, false);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.settings_id_seq', 11, true);


--
-- Name: user_off_days_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_off_days_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 69, true);


--
-- Name: vehicle_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.vehicle_types_id_seq', 1, false);


--
-- Name: work_schedule_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_schedule_types_id_seq', 1, false);


--
-- Name: work_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_shifts_id_seq', 1, false);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


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
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


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
-- Name: vehicle_types vehicle_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_name_key UNIQUE (name);


--
-- Name: vehicle_types vehicle_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_pkey PRIMARY KEY (id);


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
-- Name: idx_customers_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_code ON public.customers USING btree (customer_code);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_emp_detail_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emp_detail_user ON public.employee_details USING btree (user_id);


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
-- Name: employee_details employee_details_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_details employee_details_vehicle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_details
    ADD CONSTRAINT employee_details_vehicle_type_id_fkey FOREIGN KEY (vehicle_type_id) REFERENCES public.vehicle_types(id) ON DELETE SET NULL;


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

\unrestrict cS0CPjUFngr3qVaTj34hYb916AyB80cqYofa8n20x04Chnbhoa8jc4NtzRAdaCg

