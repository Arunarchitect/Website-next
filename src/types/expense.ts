export interface Expense {
  id: number;
  item: { id: number; name: string };
  category: { id: number; name: string };
  brand: { id: number; name: string } | null;
  shop: { id: number; name: string } | null;
  who_spent: { id: number; username: string };
  date_of_purchase: string;
  quantity: number;
  unit: string;
  price: number;
  rate: number;
  remarks?: string;
}
