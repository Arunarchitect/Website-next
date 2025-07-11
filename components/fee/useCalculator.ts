import { useState } from "react";
import {
  serviceComponents,
  feePercentages,
  initialSelectedComponents,
  componentHierarchy,
} from "./constants";

export const useCalculator = () => {
  const [area, setArea] = useState<number | "">("");
  const [clientName, setClientName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [result, setResult] = useState<number | null>(null);
  const [serviceFees, setServiceFees] = useState<Record<string, number>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponents, setSelectedComponents] = useState(
    initialSelectedComponents
  );

  const handleCheckboxChange = (service: string) => {
    setSelectedComponents((prev) => {
      const updated = { ...prev };
      const currentState = updated[service];
      updated[service] = !currentState;

      const thisLevel = componentHierarchy[service];

      if (!currentState) {
        Object.entries(componentHierarchy).forEach(([key, level]) => {
          if (level < thisLevel) updated[key] = true;
        });
      } else {
        const hasDependent = Object.entries(componentHierarchy).some(
          ([key, level]) => level > thisLevel && updated[key] === true
        );
        if (hasDependent) return prev;
      }

      return updated;
    });
  };

  const handleSelectAllChange = () => {
    const newState = !selectAll;
    setSelectAll(newState);
    const updated = Object.fromEntries(
      serviceComponents.map((key) => [key, newState])
    );
    setSelectedComponents(updated);
  };

  const handleCalculate = async () => {
    setError(null);

    if (!clientName.trim()) {
      setError("Please enter client name");
      return;
    }
    if (!promoCode.trim()) {
      setError("Please enter promo code");
      return;
    }
    if (!area || area <= 0) {
      setError("Please enter a valid area");
      return;
    }
    const selected = Object.entries(selectedComponents).filter(
      ([, val]) => val
    );
    if (
      selected.length === 1 &&
      selected[0][0] === "Advance Payment and Site Visit"
    ) {
      setError("Please select at least one more service.");
      return;
    }

    try {
      const res = await fetch(
        `https://api.modelflick.com/fees/fee/?promo_code=${promoCode}`
      );
      const data = await res.json();

      if (data?.error) {
        setError(data.error);
        return;
      }

      const designFee = data?.base_fee_per_sqft;
      const areaValue = Number(area);

      const calculatedFees: Record<string, number> = {};
      let totalFee = 0;

      Object.keys(selectedComponents).forEach((service) => {
        if (selectedComponents[service]) {
          const fee = designFee * (feePercentages[service] / 100) * areaValue;
          calculatedFees[service] = fee;
          totalFee += fee;
        }
      });

      setServiceFees(calculatedFees);
      setResult(totalFee);
    } catch (err) {
      console.error("Error fetching fee:", err);
      setError("Failed to fetch fee. Please try again.");
    }
  };

  return {
    area,
    setArea,
    clientName,
    setClientName,
    promoCode,
    setPromoCode,
    result,
    serviceFees,
    selectAll,
    error,
    selectedComponents,
    handleCheckboxChange,
    handleSelectAllChange,
    handleCalculate,
  };
};