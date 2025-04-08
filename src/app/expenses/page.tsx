'use client';

import { useState, useEffect, ChangeEvent, Fragment } from 'react';
import { Expense } from '@/types/expense';
import { parseISO, format } from 'date-fns';
import { saveAs } from 'file-saver';

const CORRECT_PIN = '1234';

type Item = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  name: string;
};

type Brand = {
  id: number;
  name: string;
};

type Shop = {
  id: number;
  name: string;
};

type MonthlyExpenses = {
  [month: string]: {
    total: number;
    items: Expense[];
  };
};

export default function ExpensesPage() {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [createExpenseError, setCreateExpenseError] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [grouped, setGrouped] = useState<MonthlyExpenses>({});

  const [itemsList, setItemsList] = useState<Item[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [brandsList, setBrandsList] = useState<Brand[]>([]);
  const [shopsList, setShopsList] = useState<Shop[]>([]);

  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  const [isAddingNewShop, setIsAddingNewShop] = useState(false);
  const [newShopName, setNewShopName] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedExpense, setEditedExpense] = useState<Partial<Expense & {
    item_id: number | string;
    category_id: number | string;
    brand_id: number | string;
    shop_id: number | string;
  }>>({});

  const [newExpense, setNewExpense] = useState<Partial<Expense & {
    item_id: string;
    category_id: string;
    brand_id: string;
    shop_id: string;
    quantity: string;
    price: string;
    rate: string;
  }>>({
    date_of_purchase: '',
    item_id: '',
    category_id: '',
    brand_id: '',
    shop_id: '',
    quantity: '',
    unit: 'kg',
    price: '',
    rate: '',
    remarks: '',
  });

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === CORRECT_PIN) setIsAuthenticated(true);
    else setError('Incorrect PIN');
  };

  const fetchExpenses = () => {
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
  };

  const fetchItems = () => {
    fetch('https://api.modelflick.com/expenses/items/')
      .then((res) => res.json())
      .then((data: Item[]) => setItemsList(data))
      .catch((err) => console.error('Error fetching items:', err));
  };

  const fetchCategories = () => {
    fetch('https://api.modelflick.com/expenses/categories/')
      .then((res) => res.json())
      .then((data: Category[]) => setCategoriesList(data))
      .catch((err) => console.error('Error fetching categories:', err));
  };

  const fetchBrands = () => {
    fetch('https://api.modelflick.com/expenses/brands/')
      .then((res) => res.json())
      .then((data: Brand[]) => setBrandsList(data))
      .catch((err) => console.error('Error fetching brands:', err));
  };

  const fetchShops = () => {
    fetch('https://api.modelflick.com/expenses/shops/')
      .then((res) => res.json())
      .then((data: Shop[]) => setShopsList(data))
      .catch((err) => console.error('Error fetching shops:', err));
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchExpenses();
      fetchItems();
      fetchCategories();
      fetchBrands();
      fetchShops();
    }
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

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditedExpense({
      ...expense,
      item_id: expense.item.id,
      category_id: expense.category.id,
      brand_id: expense.brand?.id || '',
      shop_id: expense.shop?.id || '',
    });
  };

  const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedExpense((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (expenseId: number) => {
    fetch(`https://api.modelflick.com/expenses/expenses/${expenseId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedExpense),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to update the expense.');
        return res.json();
      })
      .then(() => {
        setEditingId(null);
        setEditedExpense({});
        fetchExpenses();
      })
      .catch((err) => console.error(err));
  };

  const handleDelete = (expenseId: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      fetch(`https://api.modelflick.com/expenses/expenses/${expenseId}/`, { method: 'DELETE' })
        .then((res) => {
          if (res.status !== 204) throw new Error('Failed to delete the expense.');
          fetchExpenses();
        })
        .catch((err) => console.error(err));
    }
  };

  const handleCopy = (expense: Expense) => {
    const { id, ...copyData } = expense;
    const copyPayload: any = {
      ...copyData,
      item_id: expense.item.id,
      category_id: expense.category.id,
      who_spent_id: expense.who_spent.id,
    };
    if (expense.brand) copyPayload.brand_id = expense.brand.id;
    if (expense.shop) copyPayload.shop_id = expense.shop.id;

    fetch('https://api.modelflick.com/expenses/expenses/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(copyPayload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to copy the expense.');
        return res.json();
      })
      .then(() => fetchExpenses())
      .catch((err) => console.error(err));
  };

  const handleNewExpenseChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewExpense((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateNewExpense = () => {
    setCreateExpenseError('');
    const payload: any = {
      ...newExpense,
      item_id: Number(newExpense.item_id),
      category_id: Number(newExpense.category_id),
      who_spent_id: 1,
      quantity: Number(newExpense.quantity),
      price: Number(newExpense.price),
      rate: Number(newExpense.rate),
    };
    if (newExpense.brand_id) payload.brand_id = Number(newExpense.brand_id);
    if (newExpense.shop_id) payload.shop_id = Number(newExpense.shop_id);

    fetch('https://api.modelflick.com/expenses/expenses/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data?.detail || 'Failed to create the new expense.');
          });
        }
        return res.json();
      })
      .then(() => {
        setNewExpense({
          date_of_purchase: '',
          item_id: '',
          category_id: '',
          brand_id: '',
          shop_id: '',
          quantity: '',
          unit: 'kg',
          price: '',
          rate: '',
          remarks: '',
        });
        setCreateExpenseError('');
        fetchExpenses();
      })
      .catch((err) => {
        console.error(err);
        setCreateExpenseError(err.message);
      });
  };

  const handleNewItemNameChange = (e: ChangeEvent<HTMLInputElement>) => setNewItemName(e.target.value);
  const handleAddNewItem = () => {
    fetch('https://api.modelflick.com/expenses/items/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItemName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to add new item.');
        return res.json();
      })
      .then((data: Item) => {
        fetchItems();
        setNewExpense((prev) => ({ ...prev, item_id: String(data.id) }));
        setNewItemName('');
        setIsAddingNewItem(false);
      })
      .catch((err) => console.error(err));
  };

  const handleNewCategoryNameChange = (e: ChangeEvent<HTMLInputElement>) => setNewCategoryName(e.target.value);
  const handleAddNewCategory = () => {
    fetch('https://api.modelflick.com/expenses/categories/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to add new category.');
        return res.json();
      })
      .then((data: Category) => {
        fetchCategories();
        setNewExpense((prev) => ({ ...prev, category_id: String(data.id) }));
        setNewCategoryName('');
        setIsAddingNewCategory(false);
      })
      .catch((err) => console.error(err));
  };

  const handleNewBrandNameChange = (e: ChangeEvent<HTMLInputElement>) => setNewBrandName(e.target.value);
  const handleAddNewBrand = () => {
    fetch('https://api.modelflick.com/expenses/brands/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBrandName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to add new brand.');
        return res.json();
      })
      .then((data: Brand) => {
        fetchBrands();
        setNewExpense((prev) => ({ ...prev, brand_id: String(data.id) }));
        setNewBrandName('');
        setIsAddingNewBrand(false);
      })
      .catch((err) => console.error(err));
  };

  const handleNewShopNameChange = (e: ChangeEvent<HTMLInputElement>) => setNewShopName(e.target.value);
  const handleAddNewShop = () => {
    fetch('https://api.modelflick.com/expenses/shops/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newShopName }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to add new shop.');
        return res.json();
      })
      .then((data: Shop) => {
        fetchShops();
        setNewExpense((prev) => ({ ...prev, shop_id: String(data.id) }));
        setNewShopName('');
        setIsAddingNewShop(false);
      })
      .catch((err) => console.error(err));
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
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full">
            Submit
          </button>
        </form>
      </div>
    );
  }

  const renderRow = (expense: Expense) => {
    const isEditing = editingId === expense.id;
    return (
      <tr key={expense.id} className="border">
        <td className="p-1 border">
          {isEditing ? (
            <input
              type="date"
              name="date_of_purchase"
              value={editedExpense.date_of_purchase || expense.date_of_purchase}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            />
          ) : (
            expense.date_of_purchase
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <select
              name="item_id"
              value={editedExpense.item_id || expense.item.id}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            >
              {itemsList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          ) : (
            expense.item.name
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <select
              name="category_id"
              value={editedExpense.category_id || expense.category.id}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            >
              {categoriesList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          ) : (
            expense.category.name
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <select
              name="brand_id"
              value={editedExpense.brand_id || (expense.brand ? expense.brand.id : '')}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            >
              <option value="">-</option>
              {brandsList.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          ) : (
            expense.brand?.name || '-'
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <select
              name="shop_id"
              value={editedExpense.shop_id || (expense.shop ? expense.shop.id : '')}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            >
              <option value="">-</option>
              {shopsList.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          ) : (
            expense.shop?.name || '-'
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <input
              type="number"
              name="quantity"
              value={editedExpense.quantity || expense.quantity}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            />
          ) : (
            expense.quantity
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <select
              name="unit"
              value={editedExpense.unit || expense.unit}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            >
              <option value="kg">Kilogram</option>
              <option value="g">Gram</option>
              <option value="l">Litre</option>
              <option value="ml">Millilitre</option>
              <option value="m">Metre</option>
              <option value="cm">Centimetre</option>
              <option value="pcs">Pieces</option>
              <option value="sq.m">Square Metre</option>
            </select>
          ) : (
            expense.unit
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <input
              type="number"
              step="0.01"
              name="price"
              value={editedExpense.price || expense.price}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            />
          ) : (
            `₹${expense.price}`
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <input
              type="number"
              step="0.01"
              name="rate"
              value={editedExpense.rate || expense.rate}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
              disabled
            />
          ) : (
            `₹${parseFloat(String(expense.rate || 0)).toFixed(2)}`
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <input
              type="text"
              name="remarks"
              value={editedExpense.remarks || expense.remarks || ''}
              onChange={handleFieldChange}
              className="border rounded px-1 py-0.5"
            />
          ) : (
            expense.remarks
          )}
        </td>
        <td className="p-1 border">
          {isEditing ? (
            <button onClick={() => handleSave(expense.id)} title="Save" className="text-green-600 mr-2">
              &#10003;
            </button>
          ) : (
            <Fragment>
              <button onClick={() => handleEdit(expense)} title="Edit" className="mr-2 text-blue-600">
                Edit
              </button>
              <button onClick={() => handleCopy(expense)} title="Copy" className="mr-2 text-orange-600">
                Copy
              </button>
              <button onClick={() => handleDelete(expense.id)} title="Delete" className="text-red-600">
                Delete
              </button>
            </Fragment>
          )}
        </td>
      </tr>
    );
  };

  const renderNewExpenseRow = () => (
    <tr className="border bg-gray-50">
      <td className="p-1 border">
        <input
          type="date"
          name="date_of_purchase"
          value={newExpense.date_of_purchase || ''}
          onChange={handleNewExpenseChange}
          className="border rounded px-1 py-0.5"
        />
      </td>
      <td className="p-1 border">
        <div className="flex items-center">
          <select
            name="item_id"
            value={newExpense.item_id || ''}
            onChange={handleNewExpenseChange}
            className="border rounded px-1 py-0.5 flex-1"
          >
            <option value="" disabled>Select item</option>
            {itemsList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAddingNewItem(true)}
            title="Add new item"
            className="ml-2 text-green-600"
          >
            &#43;
          </button>
        </div>
      </td>
      <td className="p-1 border">
        <div className="flex items-center">
          <select
            name="category_id"
            value={newExpense.category_id || ''}
            onChange={handleNewExpenseChange}
            className="border rounded px-1 py-0.5 flex-1"
          >
            <option value="" disabled>Select category</option>
            {categoriesList.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAddingNewCategory(true)}
            title="Add new category"
            className="ml-2 text-green-600"
          >
            &#43;
          </button>
        </div>
      </td>
      <td className="p-1 border">
        <div className="flex items-center">
          <select
            name="brand_id"
            value={newExpense.brand_id || ''}
            onChange={handleNewExpenseChange}
            className="border rounded px-1 py-0.5 flex-1"
          >
            <option value="" disabled>Select brand</option>
            {brandsList.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAddingNewBrand(true)}
            title="Add new brand"
            className="ml-2 text-green-600"
          >
            &#43;
          </button>
        </div>
      </td>
      <td className="p-1 border">
        <div className="flex items-center">
          <select
            name="shop_id"
            value={newExpense.shop_id || ''}
            onChange={handleNewExpenseChange}
            className="border rounded px-1 py-0.5 flex-1"
          >
            <option value="" disabled>Select shop</option>
            {shopsList.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAddingNewShop(true)}
            title="Add new shop"
            className="ml-2 text-green-600"
          >
            &#43;
          </button>
        </div>
      </td>
      <td className="p-1 border">
        <input
          type="number"
          name="quantity"
          value={newExpense.quantity || ''}
          onChange={handleNewExpenseChange}
          className="border rounded px-1 py-0.5"
        />
      </td>
      <td className="p-1 border">
        <select
          name="unit"
          value={newExpense.unit || 'kg'}
          onChange={handleNewExpenseChange}
          className="border rounded px-1 py-0.5"
        >
          <option value="kg">Kilogram</option>
          <option value="g">Gram</option>
          <option value="l">Litre</option>
          <option value="ml">Millilitre</option>
          <option value="m">Metre</option>
          <option value="cm">Centimetre</option>
          <option value="pcs">Pieces</option>
          <option value="sq.m">Square Metre</option>
        </select>
      </td>
      <td className="p-1 border">
        <input
          type="number"
          step="0.01"
          name="price"
          value={newExpense.price || ''}
          onChange={handleNewExpenseChange}
          className="border rounded px-1 py-0.5"
        />
      </td>
      <td className="p-1 border">
        <input
          type="number"
          step="0.01"
          name="rate"
          value={newExpense.rate || ''}
          onChange={handleNewExpenseChange}
          className="border rounded px-1 py-0.5"
          disabled
        />
      </td>
      <td className="p-1 border">
        <input
          type="text"
          name="remarks"
          placeholder="Remarks"
          value={newExpense.remarks || ''}
          onChange={handleNewExpenseChange}
          className="border rounded px-1 py-0.5"
        />
      </td>
      <td className="p-1 border">
        <button onClick={handleCreateNewExpense} title="Add New Expense" className="text-green-600">
          &#10003;
        </button>
        {createExpenseError && (
          <p className="text-red-600 text-xs mt-1">{createExpenseError}</p>
        )}
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      {isAddingNewItem && (
        <div className="mb-4 p-4 border rounded bg-gray-100 max-w-xs">
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">New Item Name</label>
            <input
              type="text"
              value={newItemName}
              onChange={handleNewItemNameChange}
              className="border rounded px-1 py-0.5 mb-2"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => setIsAddingNewItem(false)} className="mr-2 text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={handleAddNewItem} className="text-green-600 font-semibold">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddingNewCategory && (
        <div className="mb-4 p-4 border rounded bg-gray-100 max-w-xs">
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">New Category Name</label>
            <input
              type="text"
              value={newCategoryName}
              onChange={handleNewCategoryNameChange}
              className="border rounded px-1 py-0.5 mb-2"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => setIsAddingNewCategory(false)} className="mr-2 text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={handleAddNewCategory} className="text-green-600 font-semibold">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddingNewBrand && (
        <div className="mb-4 p-4 border rounded bg-gray-100 max-w-xs">
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">New Brand Name</label>
            <input
              type="text"
              value={newBrandName}
              onChange={handleNewBrandNameChange}
              className="border rounded px-1 py-0.5 mb-2"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => setIsAddingNewBrand(false)} className="mr-2 text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={handleAddNewBrand} className="text-green-600 font-semibold">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddingNewShop && (
        <div className="mb-4 p-4 border rounded bg-gray-100 max-w-xs">
          <div className="flex flex-col">
            <label className="mb-1 font-semibold">New Shop Name</label>
            <input
              type="text"
              value={newShopName}
              onChange={handleNewShopNameChange}
              className="border rounded px-1 py-0.5 mb-2"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => setIsAddingNewShop(false)} className="mr-2 text-gray-600">
                Cancel
              </button>
              <button type="button" onClick={handleAddNewShop} className="text-green-600 font-semibold">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Expenses by Month</h1>
        <button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded">
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
                <th className="border p-1">Category</th>
                <th className="border p-1">Brand</th>
                <th className="border p-1">Shop</th>
                <th className="border p-1">Qty</th>
                <th className="border p-1">Unit</th>
                <th className="border p-1">Price</th>
                <th className="border p-1">Rate</th>
                <th className="border p-1">Remarks</th>
                <th className="border p-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((exp) => renderRow(exp))}
              {renderNewExpenseRow()}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}