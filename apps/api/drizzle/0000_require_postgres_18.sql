-- The project requires PostgreSQL 18+ (native uuidv7() for every primary key).
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 180000 THEN
    RAISE EXCEPTION 'PostgreSQL 18 or newer is required, found %', current_setting('server_version');
  END IF;
END
$$;
