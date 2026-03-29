import React, { createContext, useCallback, useContext, useState } from 'react';

export type ShoppingListItem = {
  id: string;
  emoji: string;
  name: string;
  brand: string;
  quantity: number;
};

type ShoppingListContextType = {
  shoppingList: ShoppingListItem[];
  addToList: (item: Omit<ShoppingListItem, 'quantity'>) => void;
  removeFromList: (id: string) => void;
  changeQuantity: (id: string, delta: number) => void;
  clearList: () => void;
};

const ShoppingListContext = createContext<ShoppingListContextType | null>(null);

export function ShoppingListProvider({ children }: { children: React.ReactNode }) {
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);

  const addToList = useCallback((item: Omit<ShoppingListItem, 'quantity'>) => {
    setShoppingList((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeFromList = useCallback((id: string) => {
    setShoppingList((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const changeQuantity = useCallback((id: string, delta: number) => {
    setShoppingList((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const clearList = useCallback(() => setShoppingList([]), []);

  return (
    <ShoppingListContext.Provider value={{ shoppingList, addToList, removeFromList, changeQuantity, clearList }}>
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList() {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) throw new Error('useShoppingList must be used inside ShoppingListProvider');
  return ctx;
}
