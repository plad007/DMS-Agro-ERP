
import React, { ReactNode } from 'react';
import { LayoutDashboard, FileText, Truck, LogOut, Settings, Sprout, Users } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Cockpit', icon: LayoutDashboard },
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'logistics', label: 'Logística', icon: Truck },
    { id: 'registries', label: 'Cadastros', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-emerald-900 text-white flex flex-col shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-emerald-800">
          <div className="bg-white p-1.5 rounded-lg">
            <Sprout className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">DMS Agro</h1>
            <p className="text-xs text-emerald-300">Trading & Corretagem</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors ${
                activePage === item.id 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-emerald-800">
          <button className="flex items-center w-full px-4 py-2 text-emerald-200 hover:text-white transition-colors">
            <LogOut className="w-5 h-5 mr-3" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-xl font-semibold text-slate-800">
            {navItems.find(n => n.id === activePage)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-slate-700">Admin User</p>
              <p className="text-xs text-slate-500">Diretor Comercial</p>
            </div>
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
