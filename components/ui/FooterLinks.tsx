"use client";
import React from "react";
import Link from "next/link";
import { FaTwitter, FaYoutube, FaGithub, FaTelegramPlane } from "react-icons/fa";

const FooterLinks: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-gray-700 bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-screen-xl px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
        
        {/* Colonne 1 : Produit */}
        <div>
          <h4 className="mb-3 text-base font-semibold text-white">CryptoPilot</h4>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-white">Portefeuille</Link></li>
            <li><Link href="/transactions" className="hover:text-white">Transactions</Link></li>
            <li><Link href="/insights" className="hover:text-white">Insights</Link></li>
          </ul>
        </div>

        {/* Colonne 2 : Réseaux sociaux */}
        <div>
          <h4 className="mb-3 text-base font-semibold text-white">Réseaux</h4>
          <ul className="space-y-2">
            <li>
              <a href="https://twitter.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                <FaTwitter className="text-blue-400" /> Twitter
              </a>
            </li>
            <li>
              <a href="https://youtube.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                <FaYoutube className="text-red-500" /> YouTube
              </a>
            </li>
            <li>
              <a href="https://github.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                <FaGithub className="text-gray-300" /> GitHub
              </a>
            </li>
            <li>
              <a href="https://t.me/" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
                <FaTelegramPlane className="text-sky-400" /> Telegram
              </a>
            </li>
          </ul>
        </div>

        {/* Colonne 3 : Infos */}
        <div>
          <h4 className="mb-3 text-base font-semibold text-white">À propos</h4>
          <p className="text-sm leading-relaxed">
            CryptoPilot est un outil d’analyse de portefeuille crypto basé sur l’IA.
            Suivez vos actifs, importez vos transactions, et prenez de meilleures décisions.
          </p>
          <p className="mt-3 text-xs text-gray-500">
            © {new Date().getFullYear()} CryptoPilot. Tous droits réservés.
          </p>
        </div>

      </div>
    </footer>
  );
};

export default FooterLinks;
