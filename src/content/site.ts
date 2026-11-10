/**
 * All static landing-page copy, in one place.
 *
 * SERVICES AND PRICES ARE DELIBERATELY NOT HERE. They are read from the database
 * (the `Service` table, seeded in T3.2) by `features/landing/queries.ts` at build
 * time, so the clinic can edit the catalogue from the admin UI without a code
 * change. Putting prices in this file would fork the source of truth.
 */

export interface HowItWorksStep {
  readonly title: string;
  readonly body: string;
}

export interface Doctor {
  readonly name: string;
  readonly role: string;
  readonly bio: string;
  readonly credentials: string;
}

export interface SiteContent {
  readonly clinicName: string;
  readonly hero: {
    readonly headline: string;
    readonly subhead: string;
    readonly ctaLabel: string;
    readonly secondaryCtaLabel: string;
    readonly reassurance: readonly string[];
  };
  readonly about: {
    readonly heading: string;
    readonly body: string;
    readonly doctors: readonly Doctor[];
  };
  readonly howItWorks: {
    readonly heading: string;
    readonly steps: readonly HowItWorksStep[];
  };
  readonly contact: {
    readonly addressLines: readonly string[];
    readonly phoneDisplay: string;
    readonly phoneE164: string;
    readonly email: string;
    readonly mapUrl: string;
    readonly hoursNote: string;
  };
  readonly legal: {
    readonly retentionMonths: number;
    readonly dataController: string;
  };
}

export const siteContent: SiteContent = {
  clinicName: "عيادة المنصورة الطبية",

  hero: {
    headline: "رعاية صحية تناسب حياتك اليومية",
    subhead:
      "احجز موعدك في عيادتنا في أقل من دقيقة. اختر الوقت المناسب لك، وأكّد الحجز برسالة نصية، وتعال وأنت مطمئن أن ميعادك محجوز وجاهز.",
    ctaLabel: "احجز موعدك",
    secondaryCtaLabel: "تعرّف على الخدمات والأسعار",
    reassurance: ["بدون إنشاء حساب", "تأكيد فوري برسالة نصية", "إلغاء مجاني بمكالمة هاتفية"],
  },

  about: {
    heading: "عن العيادة",
    body: "عيادتنا عيادة طب أسرة وباطنة عامة في قلب المنصورة، نحرص فيها على عدم استعجال أي مريض: مواعيدنا بوقت كافٍ يسمح للطبيب بالاستماع إليك جيدًا، ونتابع مرضانا على مدار سنوات لا دقائق معدودة.",
    doctors: [
      {
        name: "د. أحمد السيد عبد الوهاب",
        role: "أخصائي الباطنة العامة ومدير العيادة",
        bio: "أسّس د. أحمد العيادة سنة ٢٠١٤ بعد عشر سنوات من العمل في قسم الباطنة بمستشفى المنصورة الجامعي، ويتابع الحالات المزمنة والفحوصات الوقائية الدورية.",
        credentials: "بكالوريوس وماجستير الطب الباطني، جامعة المنصورة",
      },
      {
        name: "د. منى فتحي الجمال",
        role: "أخصائية طب الأسرة",
        bio: "تتابع د. منى الحالات التشخيصية والإجراءات العلاجية البسيطة، وتدير عيادة السونار الخاصة بنا مساءً كل يوم من أيام الأسبوع.",
        credentials: "ماجستير طب الأسرة، جامعة المنصورة",
      },
      {
        name: "د. كريم عادل حسنين",
        role: "أخصائي العلاج الطبيعي",
        bio: "يتولى د. كريم برامج التعافي بعد الإصابات والعمليات الجراحية، مع تركيز خاص على عودة المريض لأنشطته اليومية التي تهمّه فعلًا.",
        credentials: "بكالوريوس العلاج الطبيعي، دبلوم إعادة التأهيل الرياضي",
      },
    ],
  },

  howItWorks: {
    heading: "كيف يتم الحجز",
    steps: [
      {
        title: "اختر الخدمة والموعد",
        body: "حدد الخدمة التي تحتاجها، ثم اليوم والوقت المناسبين من بين المواعيد المتاحة فعليًا لدينا، بدون انتظار على التليفون.",
      },
      {
        title: "أكّد رقم هاتفك",
        body: "نرسل لك كودًا من ستة أرقام برسالة نصية للتأكد من إمكانية التواصل معك، والأمر لا يستغرق سوى ثوانٍ معدودة.",
      },
      {
        title: "تعال في ميعادك",
        body: "تحصل على رقم مرجعي للحجز وملف تقويم لحفظ الموعد، وسنكون جاهزين لاستقبالك في الوقت المحدد.",
      },
    ],
  },

  contact: {
    addressLines: ["عيادة المنصورة الطبية", "شارع الجمهورية", "المنصورة، الدقهلية", "مصر"],
    phoneDisplay: "+20 50 223 4567",
    phoneE164: "+20502234567",
    email: "hello@mansoura-clinic.example",
    mapUrl: "https://www.openstreetmap.org/?mlat=31.0409&mlon=31.3785#map=17/31.0409/31.3785",
    hoursNote: "العيادة مغلقة يوم الجمعة. في حالات الطوارئ يرجى الاتصال بالإسعاف على الرقم 123.",
  },

  legal: {
    retentionMonths: 24,
    dataController: "عيادة المنصورة الطبية، شارع الجمهورية، المنصورة، الدقهلية، مصر",
  },
};
