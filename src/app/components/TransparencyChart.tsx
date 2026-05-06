import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface TransparencyChartProps {
  fundAllocation: Array<{name: string; value: number; color: string}>;
  disbursementHistory: Array<{date: string; amount: number; purpose: string}>;
}

export function TransparencyChart({ fundAllocation, disbursementHistory }: TransparencyChartProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="font-semibold text-xl mb-6 text-gray-900">
        Transparansi Dana
      </h3>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h4 className="font-medium mb-4 text-gray-700">Alokasi Dana</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={fundAllocation}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {fundAllocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} />
              <Legend verticalAlign="bottom" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {fundAllocation.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">
                  Rp {item.value.toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-4 text-gray-700">Riwayat Pencairan</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={disbursementHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`}
                labelFormatter={(label) => `Tanggal: ${label}`}
              />
              <Bar dataKey="amount" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-3 max-h-48 overflow-y-auto">
            {disbursementHistory.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-gray-500">{item.date}</span>
                  <span className="font-medium text-blue-600 text-sm">
                    Rp {item.amount.toLocaleString('id-ID')}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{item.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
