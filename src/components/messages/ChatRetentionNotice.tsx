import { Clock } from 'lucide-react';

/** Chattar och ansökningar raderas automatiskt efter 24 månader (GDPR-dataminimering). */
const RETENTION_MONTHS = 24;
/** Visa raden när mindre än 3 månader återstår. */
const NOTICE_WINDOW_MONTHS = 3;

interface ChatRetentionNoticeProps {
  /** ISO-datum då konversationen skapades. */
  createdAt: string;
}

export function ChatRetentionNotice({ createdAt }: ChatRetentionNoticeProps) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const deleteAt = new Date(created);
  deleteAt.setMonth(deleteAt.getMonth() + RETENTION_MONTHS);

  const noticeFrom = new Date(deleteAt);
  noticeFrom.setMonth(noticeFrom.getMonth() - NOTICE_WINDOW_MONTHS);

  if (Date.now() < noticeFrom.getTime()) return null;

  const label = deleteAt.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-pure-white" />
      <p className="text-pure-white text-xs leading-relaxed break-words">
        Den här konversationen och tillhörande ansökan raderas automatiskt {label},
        {' '}24 månader efter att den skapades.
      </p>
    </div>
  );
}
