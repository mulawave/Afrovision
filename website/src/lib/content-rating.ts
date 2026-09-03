export type AgeClassification = "minor_safe" | "teen" | "adult";

export interface ContentRating {
  age_classification?: AgeClassification | null;
  has_explicit_language?: boolean;
  has_nudity?: boolean;
  has_violence?: boolean;
  has_revealing_clothes?: boolean;
  has_partial_nudity?: boolean;
  has_explicit_content?: boolean;
  has_parental_guidance?: boolean;
  has_erotic_dancing?: boolean;
  has_sexual_nature?: boolean;
  has_sex?: boolean;
}

export const CLASSIFICATION_OPTIONS: Array<{
  value: AgeClassification;
  label: string;
  hint: string;
}> = [
  { value: "minor_safe", label: "MINOR SAFE", hint: "12 and below" },
  { value: "teen", label: "TEEN", hint: "13 to 17" },
  { value: "adult", label: "18+", hint: "Adults only" },
];

export const PUBLIC_CLASSIFICATION_OPTIONS = CLASSIFICATION_OPTIONS.filter(
  (o) => o.value !== "adult",
);

export function getContentLabels(rating: ContentRating): string[] {
  const codes: string[] = [];
  if (rating.has_sex) codes.push("S");
  if (rating.has_sexual_nature) codes.push("SN");
  if (rating.has_nudity) codes.push("N");
  if (rating.has_explicit_language) codes.push("L");
  if (rating.has_violence) codes.push("V");
  if (rating.has_revealing_clothes) codes.push("RC");
  if (rating.has_partial_nudity) codes.push("PN");
  if (rating.has_explicit_content) codes.push("XC");
  if (rating.has_parental_guidance) codes.push("PG");
  if (rating.has_erotic_dancing) codes.push("ED");
  return codes;
}

export function getClassificationMeta(ageClassification?: AgeClassification | null): {
  label: string;
  bg: string;
  border: string;
  color: string;
} {
  if (ageClassification === "minor_safe") {
    return {
      label: "MINOR SAFE",
      bg: "rgba(34,197,94,0.2)",
      border: "1px solid rgba(34,197,94,0.6)",
      color: "#bbf7d0",
    };
  }
  if (ageClassification === "adult") {
    return {
      label: "18+",
      bg: "rgba(239,68,68,0.2)",
      border: "1px solid rgba(239,68,68,0.6)",
      color: "#fecaca",
    };
  }
  return {
    label: "TEEN",
    bg: "rgba(245,150,23,0.24)",
    border: "1px solid rgba(245,150,23,0.65)",
    color: "#fde68a",
  };
}

export const ADULT_SENSITIVE_FIELDS: Array<{
  key: keyof ContentRating;
  label: string;
}> = [
  { key: "has_nudity", label: "Has Nudity" },
  { key: "has_partial_nudity", label: "Has Partial Nudity" },
  { key: "has_explicit_content", label: "Has Explicit Content" },
  { key: "has_erotic_dancing", label: "Has Erotic Dancing" },
  { key: "has_sexual_nature", label: "Has Sexual Nature" },
  { key: "has_sex", label: "Has Sex" },
  { key: "has_revealing_clothes", label: "Has Revealing Clothes" },
];

export const GENERAL_CONTENT_FIELDS: Array<{
  key: keyof ContentRating;
  label: string;
}> = [
  { key: "has_explicit_language", label: "Has Explicit Language" },
  { key: "has_violence", label: "Has Violence" },
  { key: "has_parental_guidance", label: "Has Parental Guidance" },
];

export const ALL_CONTENT_FIELDS = [...GENERAL_CONTENT_FIELDS, ...ADULT_SENSITIVE_FIELDS];
