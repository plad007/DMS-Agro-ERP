
import React, { ReactNode, useState } from 'react';
import { LayoutDashboard, FileText, Truck, LogOut, Settings, Sprout, Users, PieChart, Menu, X } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, onNavigate }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Cockpit', icon: LayoutDashboard },
    { id: 'contracts', label: 'Contratos', icon: FileText },
    { id: 'reports', label: 'Relatórios', icon: PieChart },
    { id: 'logistics', label: 'Logística', icon: Truck },
    { id: 'registries', label: 'Cadastros', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  // LOGO DMS AGRO
  const LOGO_URL = "https://i.postimg.cc/8CmMzM9c/LOGO-DMS-SF.png"; 

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-emerald-900 text-white flex flex-col shadow-xl 
          transition-transform duration-300 ease-in-out
          md:translate-x-0 md:static
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 flex items-center justify-center border-b border-emerald-800 relative">
          {/* Logo Container */}
          <div className="bg-white p-3 rounded-xl w-full h-20 flex items-center justify-center shadow-lg">
             <img 
                src={LOGO_URL} 
                alt="Logo" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
             />
             <Sprout className="w-10 h-10 text-emerald-700 hidden" />
          </div>
          
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-2 right-2 p-1 text-emerald-200 hover:text-white md:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors ${
                activePage === item.id 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-emerald-800">
          <button className="flex items-center w-full px-4 py-2 text-emerald-200 hover:text-white transition-colors">
            <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg md:text-xl font-semibold text-slate-800 truncate">
              {navItems.find(n => n.id === activePage)?.label}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-slate-700">Admin User</p>
              <p className="text-xs text-slate-500">Diretor Comercial</p>
            </div>
            <div className="h-8 w-8 md:h-10 md:w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold border border-emerald-200 text-sm md:text-base">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
