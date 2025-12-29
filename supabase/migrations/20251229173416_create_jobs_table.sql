/*
  # Create Jobs Table for Hiring.Cafe Scraper

  1. New Tables
    - `jobs`
      - `id` (uuid, primary key) - Unique identifier for each job
      - `title` (text) - Job title
      - `company` (text) - Company name
      - `location` (text) - Job location
      - `job_type` (text) - Type of job (remote, hybrid, onsite)
      - `description` (text) - Job description
      - `summary` (text) - AI-generated short summary
      - `salary` (text) - Salary information if available
      - `url` (text) - Original job posting URL
      - `source` (text) - Source website
      - `posted_date` (timestamptz) - When the job was posted
      - `scraped_at` (timestamptz) - When we scraped this job
      - `created_at` (timestamptz) - Record creation timestamp
      - `is_active` (boolean) - Whether the job is still active

  2. Security
    - Enable RLS on `jobs` table
    - Add policy for public read access (job board should be publicly viewable)
    - Add policy for authenticated users to insert jobs (for scraper)
*/

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company text NOT NULL,
  location text DEFAULT '',
  job_type text DEFAULT '',
  description text DEFAULT '',
  summary text DEFAULT '',
  salary text DEFAULT '',
  url text DEFAULT '',
  source text DEFAULT 'hiring.cafe',
  posted_date timestamptz,
  scraped_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view jobs"
  ON jobs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert jobs"
  ON jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete jobs"
  ON jobs
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
