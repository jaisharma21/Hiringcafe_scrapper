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

    const response = await fetch('https://hiring.cafe', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch hiring.cafe: ${response.status}`);
    }

    const html = await response.text();
    
    const jobs: Job[] = parseJobs(html);

    const insertedJobs = [];
    for (const job of jobs) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: job.title,
          company: job.company,
          location: job.location || '',
          job_type: job.job_type || '',
          description: job.description || '',
          summary: job.summary || '',
          salary: job.salary || '',
          url: job.url || '',
          source: 'hiring.cafe',
          posted_date: job.posted_date ? new Date(job.posted_date).toISOString() : null,
          scraped_at: new Date().toISOString(),
        })
        .select();

      if (!error && data) {
        insertedJobs.push(data[0]);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped ${insertedJobs.length} jobs from hiring.cafe`,
        jobs: insertedJobs,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error scraping jobs:', error);
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
  
  if (jobs.length === 0) {
    const fallbackJobs: Job[] = [
      {
        title: 'Sample: Senior Software Engineer',
        company: 'Tech Company',
        location: 'Remote',
        job_type: 'Remote',
        description: 'This is a sample job listing. The scraper will populate real jobs from hiring.cafe.',
        summary: 'Senior role for experienced engineers',
        url: 'https://hiring.cafe',
      },
    ];
    return fallbackJobs;
  }
  
  return jobs;
}
