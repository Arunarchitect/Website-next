interface SpinnerProps {
  size: "sm" | "lg";
  className?: string;
}

export const Spinner = ({ size, className = "" }: SpinnerProps) => (
  <div
    className={`animate-spin rounded-full border-b-2 border-white ${
      size === "sm"
        ? "h-4 w-4"
        : "h-8 w-8 border-t-2 border-b-2 border-blue-500"
    } ${className}`}
  />
);

interface LoadingStateProps {
  message: string;
}

export const LoadingState = ({ message }: LoadingStateProps) => (
  <div className="text-center py-8">
    <Spinner size="lg" className="mx-auto mb-3" />
    <p className="text-gray-600">{message}</p>
  </div>
);