import React from 'react';

// --- TYPES DE NAVIGATION ---
export type ViewStateName = 
  | 'home' | 'search' | 'news' | 'garages' | 'tips' | 'contact' | 'faq' 
  | 'about' | 'sitemap' | 'legal' | 'security' | 'terms' | 'cookies' 
  | 'listing-details' | 'article-details' | 'tip-details' | 'deposit' | 'edit-listing' 
  | 'garage-details' | 'favorites' | 'dashboard' | 'dashboard-pro' 
  | 'tech-specs-brands' | 'tech-specs-models' | 'tech-specs-details'
  | 'comparator' | 'admin' | 'api-test' | 'reset-password' | 'not-found';

export interface NavigationParams {
  id?: number | string;
  ids?: string; // Pour passer plusieurs IDs au comparateur (ex: "1,2,3")
  brand?: string;
  model?: string;
  tab?: string;
  title?: string;
  name?: string;
  success?: boolean;
  seller?: string;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface SearchFilters {
  search?: string;
  seller?: string;
  /** Exact seller id — used to scope results to one professional's boutique. */
  sellerId?: string | number;
  type?: string;
  brand?: string;
  model?: string; 
  location?: string;
  aroundMe?: boolean;
  onlyPro?: boolean;
  conditions?: string[];
  minYear?: number;
  maxYear?: number;
  minKm?: number;
  maxKm?: number;
  minPrice?: number;
  maxPrice?: number;
  minCC?: number;
  maxCC?: number;
}

/**
 * Interface BasePageProps - Propriétés communes injectées dans tous les composants de page.
 */
export interface BasePageProps {
  onNavigate?: (view: ViewStateName, params?: NavigationParams) => void;
  onSearch?: (filters: SearchFilters) => void;
  onGoHome?: () => void;
  onBack?: () => void;
  onTriggerLogin?: () => void;
  onLogout?: () => void;
  isLoggedIn?: boolean;
  initialFilters?: SearchFilters | null;
  listingId?: number | string;
  articleId?: number | string;
  tipId?: number | string;
  garageId?: number | string;
  specId?: number | string;
  ids?: string;
  brand?: string;
  availableInTunisia?: boolean;
  initialTab?: string;
}

// --- DOMAINE MODELS ---
export interface Listing {
  id: string | number;
  /** Short public number used in /annonce/<slug>-<number>. */
  listingNumber?: number;
  title: string;
  brand: string;
  model: string;
  price: string;
  image: string;
  images?: string[]; 
  year?: string;
  mileage?: string;
  cc?: string;
  location: string;
  date: string;
  seller: string;
  sellerId?: string | number;
  sellerType: 'Particulier' | 'Pro';
  sellerImage?: string;
  sellerVerified?: boolean;
  sellerSince?: string;
  sellerRating?: number;
  sellerReviewsCount?: number;
  sellerListingsCount?: number;
  sellerFacebook?: string;
  sellerInstagram?: string;
  sellerTiktok?: string;
  phone?: string;
  /**
   * Per-listing contact preference (migration 023).
   *  - 'phone'    → seller's number is exposed; call/WhatsApp buttons enabled
   *  - 'callback' → number is hidden; only in-app message + callback request
   * Defaults to 'phone' when the backend sends nothing (legacy listings).
   */
  contactMethod?: 'phone' | 'callback';
  condition: 'Excellent' | 'Très bon' | 'Bon' | 'Neuf' | 'État neuf' | 'Correct' | 'À réparer' | 'Pour pièces';
  dealRating?: 1 | 2 | 3; 
  equipment?: string[];
  type: 'Moto' | 'Scooter' | 'Quad' | 'Accessoires'; 
  description?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** Server-computed distance in km (set when query had lat/lng). */
  distance?: number | null;
  /**
   * Free-form per-category metadata (migration 024). For accessory listings,
   * holds the wizard fields the buyer needs to see on the detail page:
   *   accessoryType, helmetType, visorType[], size, gender, shoeSize,
   *   antiTheftType, intercomFeatures[]
   */
  attributes?: Record<string, string | string[]>;
}

export interface Garage {
  id: string | number;
  name: string;
  image: string;
  rating: number;
  description?: string;
  address?: string;
  location?: string; 
  hours?: string;
  reviewsCount?: number;
  specialties?: string[];
  specialty?: string; 
  isVerified?: boolean;
  images?: string[];
  phone?: string;
  website?: string;
  email?: string;
  coordinates?: { lat: number; lng: number };
  services?: GarageService[];
  reviewsList?: GarageReview[]; 
}

export interface GarageService {
  name: string;
  price?: string;
  icon?: React.ReactNode;
}

export interface GarageReview {
  id: number;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  content: string;
  helpfulCount: number;
  isVerifiedOwner?: boolean;
}

// (Garage interface defined above with id: string | number — single source of truth)

export interface Article {
  // UUID strings in the new backend; kept loose for legacy numeric ids.
  id: number | string;
  title: string;
  category: 'Nouveautés' | 'Essais' | 'Tech' | 'Scooters' | 'Électrique';
  image: string;
  date: string;
  readTime: string;
  author: string;
  summary: string;
  content?: string; 
  tags?: string[];
  isFeatured?: boolean;
}

export interface Tip {
  // UUID strings in the new backend; kept loose for legacy numeric ids.
  id: number | string;
  title: string;
  category: 'Entretien' | 'Sécurité' | 'Équipement' | 'Conduite' | 'Législation';
  summary: string;
  content?: string; 
  tools?: string[]; 
  image: string;
  date: string;
  author: string;
  readTime: string;
  difficulty: 'Débutant' | 'Intermédiaire' | 'Expert';
}

export interface BikeModel {
  id: number | string;
  name: string;
  brand: string;
  image: string;
  price: string;
}

export interface Review {
  id: number;
  name: string;
  role: string;
  image: string;
  content: string;
  rating: number;
  date: string;
  isAdminEntry?: boolean;
}

export interface CategoryItem {
  icon: React.ElementType;
  label: string;
}

export interface TechSpec {
  id: number | string;
  brand: string;
  model: string;
  year: number;
  category: 'Roadster' | 'Sportive' | 'Trail' | 'Scooter' | 'Custom' | 'Off-road';
  priceNew: string;
  image: string;
  gallery?: string[];
  engine: {
    type: string;
    cc: string;
    power: string;
    torque: string;
    fuelSystem: string;
    cooling: string;
    transmission: string;
  };
  chassis: {
    frame: string;
    suspensionFront: string;
    travelFront?: string;
    suspensionRear: string;
    travelRear?: string;
    brakesFront: string;
    brakesRear: string;
    tireFront: string;
    tireRear: string;
  };
  electronics: {
    abs: string;
    tcs: string;
    ridingModes: string;
    quickshifter: string;
    lighting?: string;
    usb?: string;
    dashboard?: string;
    connectivity?: string;
    cruiseControl?: string;
    keyless?: string;
    other?: string;
  };
  /** Garantie & Entretien — empty values are hidden on the public page. */
  maintenance?: {
    warranty?: string;
    firstService?: string;
    serviceInterval?: string;
  };
  /** Short public slug used in /fiche-technique/<slug>. */
  slug?: string;
  dimensions: {
    weight: string;
    seatHeight: string;
    tank: string;
    length: string;
    wheelbase: string;
  };
  consumption?: string;
  topSpeed?: string;
  normLogo?: string;
  importer?: Importer | null;
  importerId?: string | null;
}

export interface Importer {
  id: string;
  name: string;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  description?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  is_active?: boolean;
  /** Optional: brands carried by this importer (returned when ?with_brands=true). */
  brands?: string[];
}

export interface AdCampaign {
  id: number;
  title: string;
  client: string;
  zone: 'news_top' | 'search_feed' | 'garage_sidebar' | 'listing_sidebar' | 'search_sidebar' | 'popup';
  location: string;
  startDate: string;
  endDate: string;
  mediaType: 'Image' | 'Script';
  mediaUrl: string; 
  linkUrl: string; 
  ctaText?: string; 
  description?: string; 
  isActive: boolean;
  views: number;
  clicks: number;
}