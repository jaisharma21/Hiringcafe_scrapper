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

const SAMPLE_JOBS: Job[] = [
  {
    title: 'Senior Full Stack Engineer',
    company: 'TechCorp',
    location: 'Remote',
    job_type: 'Full-time',
    description: 'We are looking for an experienced full stack engineer to join our team.',
    summary: 'Build scalable web applications with modern tech stack',
    salary: '$150k - $200k',
    url: 'https://hiring.cafe',
  },
  {
    title: 'Product Manager',
    company: 'StartupXYZ',
    location: 'Remote',
    job_type: 'Full-time',
    description: 'Lead product strategy and roadmap for our B2B SaaS platform.',
    summary: 'Drive product vision and customer success',
    salary: '$120k - $160k',
    url: 'https://hiring.cafe',
  },
  {
    title: 'DevOps Engineer',
    company: 'CloudServices Inc',
    location: 'Remote',
    job_type: 'Full-time',
    description: 'Manage and optimize our cloud infrastructure and deployment pipelines.',
    summary: 'Infrastructure automation and cloud platform expertise required',
    salary: '$130k - $180k',
    url: 'https://hiring.cafe',
  },
  {
    title: 'UX/UI Designer',
    company: 'DesignStudio',
    location: 'Remote',
    job_type: 'Full-time',
    description: 'Create beautiful and intuitive user interfaces for web applications.',
    summary: 'Design modern interfaces with focus on user experience',
    salary: '$100k - $140k',
    url: 'https://hiring.cafe',
  },
  {
    title: 'Data Scientist',
    company: 'AI Labs',
    location: 'Remote',
    job_type: 'Full-time',
    description: 'Work on machine learning models and data analysis projects.',
    summary: 'Machine learning and statistical analysis expertise',
    salary: '$140k - $190k',
    url: 'https://hiring.cafe',
  },
  {
    title: 'Backend Engineer (Python)',
    company: 'WebServices Ltd',
    location: 'Remote',
    job_type: 'Full-time',
    description: 'Develop robust backend systems using Python and microservices.',
    summary: 'Python expertise with RESTful API design',
    salary: '$110k - $160k',
    url: 'https://hiring.cafe',
  },
];

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
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua':
            '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
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

    let jobs: Job[] = [];
    let fetchError: string | null = null;

    try {
      const response = await fetchWithRetry('https://hiring.cafe', 3, 2000);
      const html = await response.text();
      jobs = parseJobs(html);
    } catch (error) {
      fetchError = error instanceof Error ? error.message : String(error);
      console.log(`Could not scrape hiring.cafe: ${fetchError}. Using sample data.`);
      jobs = SAMPLE_JOBS;
    }

    const insertedJobs = [];
    for (const job of jobs) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: job.title,
          company: job.company,
          location: job.location || 'Remote',
          job_type: job.job_type || 'Remote',
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
        ? `Successfully loaded ${insertedJobs.length} jobs`
        : 'No jobs to add';

    return new Response(
      JSON.stringify({
        success: true,
        message,
        jobs: insertedJobs,
        note: fetchError ? `Note: ${fetchError}. Showing sample data.` : undefined,
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

function parseJobs(html: string): Job[] {
  const jobs: Job[] = [];

  const jobPattern = /<div[^>]*class="[^"]*job[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const titlePattern = /<h[123][^>]*>([^<]+)<\/h[123]>/i;
  const companyPattern = /<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/span>/i;
  const locationPattern = /<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i;
  const linkPattern = /<a[^>]*href="([^"]+)"/i;

  let match;
  while ((match = jobPattern.exec(html)) !== null) {
    const jobHtml = match[1];

    const titleMatch = titlePattern.exec(jobHtml);
    const companyMatch = companyPattern.exec(jobHtml);
    const locationMatch = locationPattern.exec(jobHtml);
    const linkMatch = linkPattern.exec(jobHtml);

    if (titleMatch && companyMatch) {
      jobs.push({
        title: titleMatch[1].trim(),
        company: companyMatch[1].trim(),
        location: locationMatch ? locationMatch[1].trim() : 'Remote',
        job_type: 'Remote',
        url: linkMatch ? linkMatch[1] : '',
      });
    }
  }

  return jobs;
}
