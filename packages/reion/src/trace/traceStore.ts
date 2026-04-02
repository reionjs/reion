export type TraceRecord = {
  route?: string;
  totalMs?: number;
};

export type TraceStore = {
  add: (record: TraceRecord) => void;
  list: () => TraceRecord[];
};

export function createInMemoryTraceStore(): TraceStore {
  const records: TraceRecord[] = [];
  return {
    add: (record) => {
      records.push(record);
    },
    list: () => records.slice()
  };
}

