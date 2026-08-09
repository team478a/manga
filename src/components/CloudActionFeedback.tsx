export function CloudActionFeedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-4 text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-4 text-emerald-800"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </>
  );
}
