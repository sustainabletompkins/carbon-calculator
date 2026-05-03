CREATE TABLE public.offsetters (
id integer NOT NULL,
name character varying(255),
description character varying(255),
avatar_file_name character varying(255),
avatar_content_type character varying(255),
avatar_file_size integer,
avatar_updated_at timestamp without time zone
);

CREATE TABLE public.offsets (
id integer NOT NULL,
user_id integer,
title character varying(255),
pounds double precision,
cost double precision,
purchased boolean DEFAULT false,
name character varying(255),
zipcode integer,
created_at timestamp without time zone,
updated_at timestamp without time zone,
email character varying(255),
team_id integer DEFAULT 0,
individual_id integer DEFAULT 0,
region_id bigint,
checkout_session_id character varying,
offset_type character varying,
offset_interval character varying
);

CREATE TABLE public.cart_items (
id bigint NOT NULL,
title character varying,
cost double precision,
pounds double precision,
user_id bigint,
session_id integer,
checkout_session_id character varying,
price_id character varying,
schedule character varying,
purchased boolean DEFAULT false,
created_at timestamp without time zone NOT NULL,
updated_at timestamp without time zone NOT NULL,
offset_type character varying,
offset_interval character varying,
frequency character varying
);

CREATE TABLE public.regions (
id bigint NOT NULL,
name character varying,
counties character varying,
zipcodes text[] DEFAULT '{}'::text[]
);

CREATE TABLE public.stats (
id integer NOT NULL,
pounds integer,
dollars double precision,
offsets integer,
awardees integer,
wheel_spins integer DEFAULT 0
);

CREATE TABLE public.teams (
id integer NOT NULL,
name character varying(255),
members integer,
pounds integer DEFAULT 0,
count integer,
participation_rate double precision,
region_id bigint
);

CREATE TABLE public.team_members (
id integer NOT NULL,
email character varying(255),
name character varying(255),
offsets integer,
team_id integer,
founder boolean,
user_id integer,
created_at timestamp without time zone,
updated_at timestamp without time zone
);

CREATE TABLE public.individuals (
id integer NOT NULL,
name character varying(255),
pounds integer,
count integer,
email character varying(255),
region_id bigint
);
