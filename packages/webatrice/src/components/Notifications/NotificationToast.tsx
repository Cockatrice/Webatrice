interface NotificationToastProps {
  title: string;
  body?: string;
}

export default function NotificationToast({ title, body }: NotificationToastProps) {
  return (
    <p className="truncate" title={body ? `${title} ${body}` : title}>
      <span className="font-semibold text-text-primary">{title}</span>
      {body && <span className="text-text-secondary"> {body}</span>}
    </p>
  );
}
