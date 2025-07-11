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
  const [consultantData, setConsultantData] = useState<{
    consultant: string;
    designation: string;
    education: string;
    url: string;
  } | null>(null);

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
    setConsultantData(null);

    if (!clientName.trim()) {
      setError("Please enter client name");
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
        `https://api.modelflick.com/fees/fees/?promo_code=${encodeURIComponent(
          promoCode
        )}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch fee data");
      }

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Store consultant data from API
      setConsultantData({
        consultant: data.consultant,
        designation: data.designation,
        education: data.education,
        url: data.url,
      });

      const designFee = parseFloat(data.base_fee_per_sqft);
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
      console.error("Calculation error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to calculate. Please try again."
      );
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
    consultantData,
    handleCheckboxChange,
    handleSelectAllChange,
    handleCalculate,
  };
};
