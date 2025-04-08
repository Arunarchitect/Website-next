'use client';

import { useState, useEffect } from 'react';
import { Expense } from '@/types/expense';
import { parseISO, format } from 'date-fns';
import { saveAs } from 'file-saver';

const CORRECT_PIN = '1234';

type MonthlyExpenses = {
  [month: string]: {
    total: number;
    items: Expense[];
  };
};

export default function ExpensesPage() {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [grouped, setGrouped] = useState<MonthlyExpenses>({});
  const [error, setError] = useState('');

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === CORRECT_PIN) {
      setIsAuthenticated(true);
    } else {
      setError('Incorrect PIN');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    fetch('https://api.modelflick.com/expenses/expenses/')
      .then((res) => res.json())
      .then((data: Expense[]) => {
        setExpenses(data);
        const monthly: MonthlyExpenses = {};

        data.forEach((exp) => {
          const date = parseISO(exp.date_of_purchase);
          const month = format(date, 'yyyy-MM');

          if (!monthly[month]) {
            monthly[month] = { total: 0, items: [] };
          }

          monthly[month].total += parseFloat(String(exp.price));
          monthly[month].items.push(exp);
        });

        setGrouped(monthly);
      });
  }, [isAuthenticated]);

  const downloadCSV = () => {
    const header = [
      'Date',
      'Item',
      'Category',
      'Brand',
      'Shop',
      'Qty',
      'Unit',
      'Price',
      'Rate',
      'Remarks',
    ];

    const rows = expenses.map((exp) => [
      exp.date_of_purchase,
      exp.item.name,
      exp.category.name,
      exp.brand?.name || '',
      exp.shop?.name || '',
      exp.quantity,
      exp.unit,
      exp.price,
      exp.rate,
      exp.remarks || '',
    ]);

    const csvContent =
      [header, ...rows]
        .map((row) =>
          row
            .map((val) =>
              typeof val === 'string' && val.includes(',') ? `"${val}"` : val
            )
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'expenses.csv');
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h1 className="text-xl font-semibold mb-4">Enter PIN to Continue</h1>
        <form onSubmit={handlePinSubmit} className="space-y-4">
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Enter PIN"
            className="w-full border rounded px-3 py-2"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
          >
            Submit
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Expenses by Month</h1>
        <button
          onClick={downloadCSV}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded"
        >
          Download CSV
        </button>
      </div>

      {Object.entries(grouped).map(([month, { total, items }]) => (
        <div key={month} className="mb-6">
          <h2 className="text-xl font-bold mb-2">
            {month} — ₹{total.toFixed(2)}
          </h2>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1">Date</th>
                <th className="border p-1">Item</th>
                <th className="border p-1">Qty</th>
                <th className="border p-1">Unit</th>
                <th className="border p-1">Price</th>
                <th className="border p-1">Rate</th>
                <th className="border p-1">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {items.map((exp) => (
                <tr key={exp.id}>
                  <td className="border p-1">{exp.date_of_purchase}</td>
                  <td className="border p-1">{exp.item.name}</td>
                  <td className="border p-1">{exp.quantity}</td>
                  <td className="border p-1">{exp.unit}</td>
                  <td className="border p-1">₹{exp.price}</td>
                  <td className="border p-1">
                    ₹{parseFloat(String(exp.rate || 0)).toFixed(2)}
                  </td>
                  <td className="border p-1">{exp.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
