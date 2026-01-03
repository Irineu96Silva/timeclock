import ptBR from "./ptBR";

type Params = Record<string, string | number>;

const dictionary = ptBR as Record<string, unknown>;

const getValue = (key: string) => {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);
};

export const t = (key: string, params?: Params) => {
  const value = getValue(key);
  if (typeof value !== "string") {
    return key;
  }
  if (!params) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
    const replacement = params[paramKey];
    return replacement === undefined ? match : String(replacement);
  });
};
