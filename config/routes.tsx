import React, { lazy } from 'react';
import { ViewStateName, BasePageProps } from '../types';

// Composants critiques chargés statiquement
import Hero from '../components/Hero';
import PopularModels from '../components/PopularModels';
import LatestTechSpecs from '../components/LatestTechSpecs';
import PopularBrands from '../components/PopularBrands';
import PopularGarages from '../components/PopularGarages';
import Reviews from '../components/Reviews';
const SearchResults = lazy(() => import('../components/SearchResults'));
import RecentListings from '../components/RecentListings';

// Vues secondaires chargées de manière différée (Lazy Loading)
const News = lazy(() => import('../components/News'));
const Garages = lazy(() => import('../components/Garages'));
const Tips = lazy(() => import('../components/Tips'));
const Contact = lazy(() => import('../components/Contact'));
const FAQ = lazy(() => import('../components/FAQ'));
const About = lazy(() => import('../components/About'));
const Sitemap = lazy(() => import('../components/Sitemap'));
const Legal = lazy(() => import('../components/Legal'));
const Security = lazy(() => import('../components/Security'));
const Terms = lazy(() => import('../components/Terms'));
const Cookies = lazy(() => import('../components/Cookies'));
const ListingDetails = lazy(() => import('../components/ListingDetails'));
const ArticleDetails = lazy(() => import('../components/ArticleDetails'));
const TipDetails = lazy(() => import('../components/TipDetails'));
const DepositAd = lazy(() => import('../components/DepositAd'));
const GarageDetails = lazy(() => import('../components/GarageDetails'));
const Favorites = lazy(() => import('../components/Favorites'));
const Dashboard = lazy(() => import('../components/Dashboard'));
const DashboardPro = lazy(() => import('../components/DashboardPro'));
const TechSpecsBrands = lazy(() => import('../components/TechSpecsBrands'));
const TechSpecsModels = lazy(() => import('../components/TechSpecsModels'));
const TechSpecsDetails = lazy(() => import('../components/TechSpecsDetails'));
const Comparator = lazy(() => import('../components/Comparator'));
const SuperAdminDashboard = lazy(() => import('../components/admin/SuperAdminDashboard'));
const ApiTester = lazy(() => import('../components/ApiTester'));
const ResetPassword = lazy(() => import('../components/ResetPassword'));
const EditListing = lazy(() => import('../components/EditListing'));
const NotFound = lazy(() => import('../components/NotFound'));

export interface RouteConfig {
  component: React.ComponentType<any>;
  layoutVariant: 'white' | 'transparent';
  hideFooter?: boolean;
  /**
   * Hide the public site Header on this route. Used by full-screen back-office
   * views (admin console, API tester) so they don't show the public navbar
   * with "Déposer une annonce", search, etc. on top of the admin chrome.
   */
  hideHeader?: boolean;
  isProtected?: boolean;
  isAdminOnly?: boolean;
}

export const ROUTES: Record<ViewStateName, RouteConfig> = {
  'not-found': { component: NotFound, layoutVariant: 'white' },
  'home': {
    component: (props: BasePageProps) => (
      <>
        <Hero onSearch={props.onSearch} onNavigate={props.onNavigate} />
        <PopularBrands onNavigate={props.onNavigate} />
        <PopularModels onNavigate={props.onNavigate} />
        <RecentListings onNavigate={props.onNavigate} />
        {/* PopularGarages — temporarily hidden until launch */}
        {/* <PopularGarages onNavigate={props.onNavigate} /> */}
        <Reviews />
      </>
    ),
    layoutVariant: 'transparent'
  },
  'search': { component: SearchResults, layoutVariant: 'white' },
  'news': { component: News, layoutVariant: 'transparent' },
  'tips': { component: Tips, layoutVariant: 'transparent' },
  'tech-specs-brands': { component: TechSpecsBrands, layoutVariant: 'transparent' },
  'tech-specs-models': { component: TechSpecsModels, layoutVariant: 'transparent' },
  'sitemap': { component: Sitemap, layoutVariant: 'transparent' },
  'legal': { component: Legal, layoutVariant: 'transparent' },
  'security': { component: Security, layoutVariant: 'transparent' },
  'terms': { component: Terms, layoutVariant: 'transparent' },
  'cookies': { component: Cookies, layoutVariant: 'transparent' },
  'garages': { component: Garages, layoutVariant: 'white' },
  'contact': { component: Contact, layoutVariant: 'white' },
  'faq': { component: FAQ, layoutVariant: 'white' },
  'about': { component: About, layoutVariant: 'transparent' },
  'listing-details': { component: ListingDetails, layoutVariant: 'white' },
  'article-details': { component: ArticleDetails, layoutVariant: 'white' },
  'tip-details': { component: TipDetails, layoutVariant: 'white' },
  'deposit': { component: DepositAd, layoutVariant: 'white', hideFooter: true, isProtected: true },
  'edit-listing': { component: EditListing, layoutVariant: 'white', hideFooter: true, isProtected: true },
  'garage-details': { component: GarageDetails, layoutVariant: 'white' },
  'favorites': { component: Favorites, layoutVariant: 'white', isProtected: true },
  'dashboard': { component: Dashboard, layoutVariant: 'white', isProtected: true },
  'dashboard-pro': { component: DashboardPro, layoutVariant: 'white', isProtected: true },
  'tech-specs-details': { component: TechSpecsDetails, layoutVariant: 'white' },
  'comparator': { component: Comparator, layoutVariant: 'transparent' },
  'admin': { component: SuperAdminDashboard, layoutVariant: 'white', isAdminOnly: true, hideFooter: true, hideHeader: true },
  // /api-test exposes the raw API surface to the user — gate behind admin
  // so it isn't reachable by simply guessing the route name in production.
  'api-test': { component: ApiTester, layoutVariant: 'white', hideFooter: true, hideHeader: true, isAdminOnly: true },
  // Public route hit from the password-reset email link.
  'reset-password': { component: ResetPassword, layoutVariant: 'white', hideFooter: true }
};