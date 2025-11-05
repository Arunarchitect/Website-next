interface SectionTitleProps {
  icon: React.ReactNode;
  title: string;
}

export const SectionTitle = ({ icon, title }: SectionTitleProps) => (
  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
    {icon}
    <span className="ml-2">{title}</span>
  </h3>
);