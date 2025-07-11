// types/index.ts
import { jsPDF } from "jspdf";
import { UserOptions } from "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: UserOptions) => jsPDF;
    lastAutoTable?: {
      finalY: number;
      pageNumber?: number;
      startY?: number;
      endY?: number;
      cursor?: { x: number; y: number };
    };
  }
}

export interface ComponentHierarchy {
  [key: string]: number;
}

export interface ComponentDescriptions {
  [key: string]: string;
}

export interface ServiceFees {
  [key: string]: number;
}

export interface JSPDFWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}