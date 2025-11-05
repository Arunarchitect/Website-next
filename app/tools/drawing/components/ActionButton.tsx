import { ActionButtonStyle } from "../types";

interface ActionButtonProps {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  style: ActionButtonStyle;
  isAvailable: boolean;
}

export const ActionButton = ({
  onClick,
  disabled,
  icon,
  label,
  style,
  isAvailable,
}: ActionButtonProps) => {
  const styles = {
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    green: "bg-green-600 hover:bg-green-700 text-white",
    purple: "bg-purple-600 hover:bg-purple-700 text-white",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed",
  };

  const className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
    isAvailable ? styles[style] : styles.disabled
  }`;

  return (
    <button onClick={onClick} disabled={disabled} className={className}>
      {icon}
      {label}
    </button>
  );
};