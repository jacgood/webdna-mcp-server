-- Create categories table if it doesn't exist
CREATE OR REPLACE FUNCTION create_categories_table_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'categories'
  ) THEN
    CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create documentation table if it doesn't exist
CREATE OR REPLACE FUNCTION create_documentation_table_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'documentation'
  ) THEN
    CREATE TABLE documentation (
      id SERIAL PRIMARY KEY,
      instruction TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      description TEXT,
      syntax TEXT,
      parameters TEXT,
      examples TEXT,
      related JSONB DEFAULT '[]'::jsonb,
      url TEXT UNIQUE,
      webdna_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(instruction, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(syntax, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(parameters, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(examples, '')), 'D')
      ) STORED
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create search index if it doesn't exist
CREATE OR REPLACE FUNCTION create_documentation_search_index_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'documentation' 
    AND indexname = 'documentation_search_idx'
  ) THEN
    CREATE INDEX documentation_search_idx ON documentation USING GIN (search_vector);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
CREATE OR REPLACE FUNCTION setup_rls_policies()
RETURNS void AS $$
BEGIN
  -- Enable RLS on tables
  ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE documentation ENABLE ROW LEVEL SECURITY;
  
  -- Create policies for anonymous access (read-only)
  DROP POLICY IF EXISTS "Allow anonymous read access to categories" ON categories;
  CREATE POLICY "Allow anonymous read access to categories" 
    ON categories FOR SELECT 
    USING (true);
  
  DROP POLICY IF EXISTS "Allow anonymous read access to documentation" ON documentation;
  CREATE POLICY "Allow anonymous read access to documentation" 
    ON documentation FOR SELECT 
    USING (true);
  
  -- Create policies for authenticated access (full access)
  DROP POLICY IF EXISTS "Allow authenticated full access to categories" ON categories;
  CREATE POLICY "Allow authenticated full access to categories" 
    ON categories FOR ALL 
    USING (auth.role() = 'authenticated');
  
  DROP POLICY IF EXISTS "Allow authenticated full access to documentation" ON documentation;
  CREATE POLICY "Allow authenticated full access to documentation" 
    ON documentation FOR ALL 
    USING (auth.role() = 'authenticated');
END;
$$ LANGUAGE plpgsql;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION create_updated_at_trigger()
RETURNS void AS $$
BEGIN
  DROP TRIGGER IF EXISTS update_documentation_updated_at ON documentation;
  CREATE TRIGGER update_documentation_updated_at
    BEFORE UPDATE ON documentation
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
END;
$$ LANGUAGE plpgsql;

-- Execute all setup functions
SELECT create_categories_table_if_not_exists();
SELECT create_documentation_table_if_not_exists();
SELECT create_documentation_search_index_if_not_exists();
SELECT setup_rls_policies();
SELECT create_updated_at_trigger();
