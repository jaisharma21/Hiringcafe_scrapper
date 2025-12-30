import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Job {
  title: string;
  company: string;
  location?: string;
  job_type?: string;
  description?: string;
  summary?: string;
  salary?: string;
  url?: string;
  posted_date?: string;
}

interface HiringCafeJob {
  id?: string;
  title: string;
  company_name?: string;
  company?: string;
  location?: string;
  country?: string;
  job_type?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  apply_url?: string;
  posted_at?: string;
  created_at?: string;
  url?: string;
}

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delayMs = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        lastError = new Error(`Rate limited (429). Attempt ${attempt + 1}/${maxRetries}`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

function convertHiringCafeJob(cafeJob: HiringCafeJob): Job {
  const company = cafeJob.company_name || cafeJob.company || 'Unknown';
  let salary = '';
  
  if (cafeJob.salary_min && cafeJob.salary_max) {
    const currency = cafeJob.salary_currency || '$';
    salary = `${currency}${cafeJob.salary_min.toLocaleString()} - ${currency}${cafeJob.salary_max.toLocaleString()}`;
  } else if (cafeJob.salary_min) {
    const currency = cafeJob.salary_currency || '$';
    salary = `${currency}${cafeJob.salary_min.toLocaleString()}+`;
  }

  return {
    title: cafeJob.title,
    company,
    location: cafeJob.location || cafeJob.country || 'Remote',
    job_type: cafeJob.job_type || 'Full-time',
    description: cafeJob.description || '',
    summary: cafeJob.description ? cafeJob.description.substring(0, 150) : '',
    salary,
    url: cafeJob.apply_url || cafeJob.url || '',
    posted_date: cafeJob.posted_at || cafeJob.created_at,
  };
}

function filterJobsByTitle(jobs: Job[], titleFilter: string): Job[] {
  if (!titleFilter) return jobs;
  
  const lowerFilter = titleFilter.toLowerCase();
  return jobs.filter((job) =>
    job.title.toLowerCase().includes(lowerFilter) ||
    job.company.toLowerCase().includes(lowerFilter)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody: { jobTitle?: string } = {};
    try {
      if (req.body) {
        requestBody = await req.json();
      }
    } catch (e) {
      // Body might be empty
    }

    const jobTitleFilter = requestBody.jobTitle || '';

    let jobs: Job[] = [];
    let fetchError: string | null = null;

    try {
      const response = await fetchWithRetry('https://hiring.cafe/api/v1/jobs', 3, 2000);
      const jsonData = await response.json();
      
      // Handle different response formats
      const jobsData = Array.isArray(jsonData) ? jsonData : jsonData.jobs || jsonData.data || [];
      
      jobs = jobsData
        .map((job: HiringCafeJob) => convertHiringCafeJob(job))
        .filter((job: Job) => job.title && job.company);
      
      if (jobs.length === 0) {
        fetchError = 'API returned no jobs';
      }
    } catch (error) {
      fetchError = error instanceof Error ? error.message : String(error);
      console.log(`Could not fetch from hiring.cafe API: ${fetchError}. Returning empty result.`);
      jobs = [];
    }

    jobs = filterJobsByTitle(jobs, jobTitleFilter);

    const insertedJobs = [];
    for (const job of jobs) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: job.title,
          company: job.company,
          location: job.location || 'Remote',
          job_type: job.job_type || 'Full-time',
          description: job.description || '',
          summary: job.summary || '',
          salary: job.salary || '',
          url: job.url || '',
          source: 'hiring.cafe',
          posted_date: job.posted_date
            ? new Date(job.posted_date).toISOString()
            : null,
          scraped_at: new Date().toISOString(),
        })
        .select();

      if (!error && data) {
        insertedJobs.push(data[0]);
      }
    }

    const message =
      insertedJobs.length > 0
        ? `Successfully loaded ${insertedJobs.length} jobs${jobTitleFilter ? ` matching "${jobTitleFilter}"` : ''}`
        : 'No jobs found';

    return new Response(
      JSON.stringify({
        success: true,
        message,
        jobs: insertedJobs,
        note: fetchError ? `Note: ${fetchError}` : undefined,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in scrape-jobs:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
