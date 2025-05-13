import { ChangeEvent, FormEvent } from 'react';
import { Input } from '@/components/forms';
import { Spinner } from '@/components/common';

interface Config {
  labelText: string;
  labelId: string;
  type: string;
  value: string;
  link?: {
    linkText: string;
    linkUrl: string;
  };
  required?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void; // Add this line
}

interface Props {
  config: Config[];
  isLoading: boolean;
  btnText: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  btnDisabled?: boolean; // Add this line
}

export default function Form({
  config,
  isLoading,
  btnText,
  onChange,
  onSubmit,
  btnDisabled = false, // Add this with default value
}: Props) {
  return (
    <form className='space-y-6' onSubmit={onSubmit}>
      {config.map(input => (
        <Input
          key={input.labelId}
          labelId={input.labelId}
          type={input.type}
          onChange={input.onChange || onChange} // Use input-specific onChange if provided
          value={input.value}
          link={input.link}
          required={input.required}
        >
          <span className="text-gray-700 dark:text-gray-300">
            {input.labelText}
          </span>
        </Input>
      ))}

      <div>
        <button
          type='submit'
          className='flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed' // Added disabled styles
          disabled={isLoading || btnDisabled} // Combine both conditions
        >
          {isLoading ? <Spinner sm /> : `${btnText}`}
        </button>
      </div>
    </form>
  );
}