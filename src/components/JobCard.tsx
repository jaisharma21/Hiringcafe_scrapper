import { Briefcase, MapPin, DollarSign, ExternalLink, Calendar } from 'lucide-react';
import { Job } from '../lib/supabase';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{job.title}</h3>
          <p className="text-lg text-gray-700 font-medium">{job.company}</p>
        </div>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 ml-4"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-3 text-sm text-gray-600">
        {job.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{job.location}</span>
          </div>
        )}
        {job.job_type && (
          <div className="flex items-center gap-1">
            <Briefcase className="w-4 h-4" />
            <span>{job.job_type}</span>
          </div>
        )}
        {job.salary && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>{job.salary}</span>
          </div>
        )}
      </div>

      {job.summary && (
        <p className="text-gray-700 mb-3 line-clamp-2">{job.summary}</p>
      )}

      {job.description && !job.summary && (
        <p className="text-gray-700 mb-3 line-clamp-2">{job.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>Scraped {formatDate(job.scraped_at)}</span>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
          {job.source}
        </span>
      </div>
    </div>
  );
}
