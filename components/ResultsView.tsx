import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { PollData } from '../types';
import { CANDIDATES } from '../constants';

interface ResultsViewProps {
  data: PollData;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ data }) => {
  
  const chartData = useMemo(() => {
    return data.results.map(r => {
      const candidate = CANDIDATES.find(c => c.id === r.candidateId);
      return {
        name: candidate?.name || 'Desconocido',
        votes: r.votes,
        percentage: data.totalVotes > 0 ? ((r.votes / data.totalVotes) * 100).toFixed(1) : '0',
        imageUrl: candidate?.imageUrl
      };
    });
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg text-sm">
          <p className="font-semibold text-gray-900">{label}</p>
          <p className="text-blue-600 font-medium">
            {payload[0].value} votos ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Resultados en Tiempo Real</h2>
        <p className="text-gray-500">Total de votos contabilizados: <span className="font-mono font-bold text-gray-900">{data.totalVotes}</span></p>
      </div>

      {/* Desktop/Tablet Chart */}
      <div className="hidden sm:block h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={140} 
              tick={{ fontSize: 12, fill: '#4b5563' }}
              interval={0}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={20}>
               {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#002B7F' : '#94a3b8'} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mobile List View (Better UX for small screens) */}
      <div className="sm:hidden space-y-4">
        {chartData.map((item, index) => (
          <div key={index} className="relative pt-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 w-2/3 truncate">{item.name}</span>
              <span className="text-sm font-semibold text-gray-900">{item.percentage}%</span>
            </div>
            <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-gray-100">
              <div 
                style={{ width: `${item.percentage}%` }} 
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ease-out ${index === 0 ? 'bg-blue-800' : 'bg-slate-400'}`}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 bg-slate-50 rounded-lg text-center">
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Esta encuesta es anónima y no oficial. Los resultados se basan en la participación de los usuarios de esta plataforma demo.
        </p>
      </div>
    </div>
  );
};
