import { BarChart3, Calendar, Plane, CheckCircle2 } from "lucide-react";

interface TripStatsProps {
  totalTrips: number;
  upcomingTrips: number;
  pastTrips: number;
  inProgressTrips?: number;
}

export function TripStats({
  totalTrips,
  upcomingTrips,
  pastTrips,
  inProgressTrips = 0,
}: TripStatsProps) {
  const stats = [
    {
      label: "Total Trips",
      value: totalTrips,
      Icon: BarChart3,
      color: "text-primary-700",
      bgColor: "bg-primary-50",
    },
    {
      label: "Upcoming",
      value: upcomingTrips,
      Icon: Calendar,
      color: "text-accent-700",
      bgColor: "bg-teal-50",
    },
    {
      label: "In Progress",
      value: inProgressTrips,
      Icon: Plane,
      color: "text-[#143D46]",
      bgColor: "bg-[#EFF5F3]",
    },
    {
      label: "Past",
      value: pastTrips,
      Icon: CheckCircle2,
      color: "text-slate-700",
      bgColor: "bg-slate-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${stat.bgColor} mb-3`}
          >
            <stat.Icon className={`h-5 w-5 ${stat.color}`} aria-hidden="true" />
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">
            {stat.label}
          </h3>
          <p className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
