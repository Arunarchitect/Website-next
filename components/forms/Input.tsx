import { ChangeEvent } from "react";

interface Props {
  labelId: string;
  type: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
  children: React.ReactNode;
  required?: boolean;
}

export default function Input({
  labelId,
  type,
  onChange,
  value,
  children,
  required = false,
}: Props) {
  return (
    <div>
      <label
        htmlFor={labelId}
        className="block text-sm/6 font-medium text-gray-900"
      >
        {children}
      </label>
      <div className="mt-2">
        <input
          id={labelId}
          className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
          name={labelId}
          type={type}
          value={value}
          onChange={onChange} // Handler is here
          required={required}
        />
      </div>
    </div>
  );
}
