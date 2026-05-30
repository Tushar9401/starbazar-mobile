import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { emitCart } from '../utils/cartEvents';

const CartContext = createContext<any>(null);

export const CartProvider = ({ children }: any) => {
  const [cart, setCart] = useState({});

  useEffect(() => {
    AsyncStorage.getItem("cart").then((raw) => {
      if (raw) setCart(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("cart", JSON.stringify(cart));
    try {
      const total = Object.values(cart as any).reduce((s: number, i: any) => s + (i.qty || 0), 0);
      emitCart(total);
    } catch (e) {
      // ignore
    }
  }, [cart]);

  const increaseQty = async (p: any) => {
    const token = await AsyncStorage.getItem("token");

    if (!token) {
      Alert.alert(
        "Login required",
        "Please login before adding to cart.",
        [{ text: "OK", onPress: () => router.push("/login") }]
      );
      return;
    }

    const key = p.item_code;

    setCart((prev: any) => ({
      ...prev,
      [key]: {
        item: p,
        qty: (prev[key]?.qty || 0) + 1,
      },
    }));
  };

  const decreaseQty = (p: any) => {
    const key = p.item_code;

    setCart((prev: any) => {
      const qty = prev[key]?.qty || 0;

      if (qty <= 1) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }

      return {
        ...prev,
        [key]: {
          ...prev[key],
          qty: qty - 1,
        },
      };
    });
  };
  // ✅ remove item completely
  const removeFromCart = (item_code: string) => {
    setCart((prev: any) => {
      const copy = { ...prev };
      delete copy[item_code];
      return copy;
    });
  };

  // ✅ clear entire cart (useful after order)
  const clearCart = async () => {
    setCart({});
    emitCart(0);
    await AsyncStorage.removeItem("cart");
  };

  return (
    <CartContext.Provider value={{ cart, setCart, increaseQty, decreaseQty, removeFromCart, clearCart}}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
