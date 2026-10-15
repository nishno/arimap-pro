import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  LayoutDashboard,
  Leaf,
  Map,
  Package,
  Users,
  Cloud,
  Menu,
  X,
  Plus,
  Search,
  Settings,
  Sun,
  CalendarDays,
  MessageSquare,
  BarChart3,
  Shield,
  LogOut,
  Download,
  RefreshCw,
  Wifi,
  Monitor,
  Layers,
  Sprout,
} from "lucide-react";
import {
  local,
  LocalError,
  sampleFields,
  sampleHarvests,
  type Session,
  type Field,
  type Harvest,
  type LocalUser,
} from "./services";
import { PROPOSED_PLANS } from "../billing/catalog";
import { defaultBillingCurrency, formatPlanPrice } from "../billing/locale";
import { MODERN_UI_VERSION } from "../utils/version";
import "./modern.css";
const modules = [
  ["overview", "Overview", LayoutDashboard],
  ["fields", "Fields & planning", Map],
  ["harvest", "Harvest", Package],
  ["tasks", "Work & tasks", CalendarDays],
  ["inventory", "Inventory", Layers],
  ["weather", "Weather & devices", Sun],
  ["market", "Marketplace", Sprout],
  ["analysis", "Agro analyst", Leaf],
  ["messages", "Communication", MessageSquare],
  ["reports", "Reports", BarChart3],
  ["team", "Team", Users],
  ["plans", "Plans & billing", Shield],
  ["settings", "Settings", Settings],
] as const;
type Page = (typeof modules)[number][0];
const classicModes: Partial<Record<Page, string>> = {
  fields: "design",
  harvest: "harvesting",
  tasks: "tasks",
  inventory: "stock",
  weather: "labs",
  market: "marketplace",
  analysis: "ai",
  messages: "community",
  reports: "accounting",
  team: "founders",
  plans: "profile",
  settings: "personalization",
};
const ka: Record<string, string> = {
  Overview: "მიმოხილვა",
  "Fields & planning": "ნაკვეთები და დაგეგმვა",
  Harvest: "მოსავალი",
  "Work & tasks": "სამუშაოები",
  Inventory: "საწყობი",
  "Weather & devices": "ამინდი და მოწყობილობები",
  Marketplace: "ბაზარი",
  "Agro analyst": "აგრო ანალიტიკოსი",
  Communication: "კომუნიკაცია",
  Reports: "ანგარიშები",
  Team: "გუნდი",
  "Plans & billing": "გეგმები და გადახდები",
  Settings: "პარამეტრები",
};
export default function ModernApp() {
  const [page, setPage] = useState<Page>("overview"),
    [menu, setMenu] = useState(false),
    [lang, setLang] = useState<"en" | "ka">("en"),
    [region, setRegion] = useState<"Georgia" | "Global">("Global"),
    [currency, setCurrency] = useState<"USD" | "GEL">("USD");
  const [session, setSession] = useState<Session | null>(null),
    [cloudUser, setCloudUser] = useState<{
      uid: string;
      name: string;
      email: string;
    } | null>(null),
    [farms, setFarms] = useState<
      {
        id: string;
        name: string;
      }[]
    >([]);
  const [fields, setFields] = useState<Field[]>([]),
    [harvests, setHarvests] = useState<Harvest[]>([]),
    [users, setUsers] = useState<LocalUser[]>([]),
    [authPage, setAuthPage] = useState<"login" | "register" | null>(
      location.pathname.includes("/register")
        ? "register"
        : location.pathname.includes("/login")
          ? "login"
          : null,
    );
  const [provider, setProvider] = useState<"local" | "cloud">("local"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [checking, setChecking] = useState(true),
    [form, setForm] = useState<"field" | "harvest" | "worker" | null>(null),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [search, setSearch] = useState("");
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(true);
  const classicReturn =
    new URLSearchParams(location.search).get("from") === "local"
      ? "/local"
      : "/classic";
  const guest = !session && !cloudUser,
    shownFields = guest ? sampleFields : fields,
    shownHarvests = guest ? sampleHarvests : harvests;
  const farmName =
    session?.farm.name ||
    farms[0]?.name ||
    (cloudUser ? "Your cloud workspace" : "Green Valley Farm");
  const t = (text: string) => (lang === "ka" ? ka[text] || text : text);
  const go = (next: Page) => {
    setPage(next);
    setMenu(false);
    setSearch("");
    setNotice("");
    setError("");
  };
  async function loadLocal() {
    const current = await local<Session>("me");
    const [f, h, u] = await Promise.all([
      local<Field[]>("fields"),
      local<Harvest[]>("harvests"),
      current.user.role === "owner"
        ? local<LocalUser[]>("users")
        : Promise.resolve([]),
    ]);
    if (mounted.current) {
      setSession(current);
      setCloudUser(null);
      setFields(f);
      setHarvests(h);
      setUsers(u);
      setRefreshed(new Date());
    }
    return current;
  }
  useEffect(() => {
    mounted.current = true;
    loadLocal()
      .catch(() => {})
      .finally(() => {
        if (mounted.current) setChecking(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!form) return;
    const old = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    formRef.current?.querySelector<HTMLInputElement>("input,select")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, [form]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation failed.");
      if (e instanceof LocalError && e.status === 401) {
        setSession(null);
        setFields([]);
        setHarvests([]);
        setUsers([]);
        setForm(null);
        setAuthPage("login");
      }
    } finally {
      setBusy(false);
    }
  }
  const submit =
    (task: (data: FormData) => Promise<void>) =>
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const element = event.currentTarget;
      await run(async () => {
        await task(new FormData(element));
      });
    };
  function classicLink(module: Page) {
    const mode = classicModes[module];
    if (mode)
      try {
        localStorage.setItem("agri-planter-mode", mode);
      } catch {}
  }
  function openForm(next: "field" | "harvest" | "worker") {
    if (guest) {
      setAuthPage("register");
      return;
    }
    if (!session) {
      classicLink(
        next === "worker" ? "team" : next === "harvest" ? "harvest" : "fields",
      );
      location.assign("/classic");
      return;
    }
    setError("");
    setRequestId(crypto.randomUUID());
    setForm(next);
  }
  async function signout() {
    await run(async () => {
      if (session) await local("logout", {});
      if (cloudUser) await (await import("./cloud")).cloudLogout();
      setSession(null);
      setCloudUser(null);
      setFields([]);
      setHarvests([]);
      setUsers([]);
      setFarms([]);
      setForm(null);
      setNotice("Signed out.");
      setAuthPage(null);
    });
  }
  const area = shownFields.reduce((sum, f) => sum + f.area_ha, 0),
    total = shownHarvests.reduce((sum, h) => sum + h.kg, 0);
  const primary = (
    <button
      className="sm-button sm-primary"
      onClick={() => openForm(page === "fields" ? "field" : "harvest")}
    >
      <Plus size={18} />
      {page === "fields" ? "Add field" : "Record harvest"}
    </button>
  );
  const bridge = (key: Page) => (
    <section className="sm-card sm-bridge">
      <div className="sm-icon-tile">
        <Layers size={24} />
      </div>
      <h2>{t(modules.find((m) => m[0] === key)![1])}</h2>
      <p>
        This module is still being redesigned. Its working version remains
        available in Classic, with the same account and permissions.
      </p>
      <a
        className="sm-button sm-primary"
        href="/classic"
        onClick={() => classicLink(key)}
      >
        Open in Classic <ArrowUpRight size={17} />
      </a>
      <small>No records are copied or converted when you switch.</small>
    </section>
  );
  return (
    <div className="sonik-modern">
      <a className="sm-skip" href="#modern-content">
        Skip to content
      </a>
      {menu && (
        <button
          className="sm-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`sm-sidebar ${menu ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sm-brand-block">
          <a href="/modern" className="sm-brand">
            <span className="sm-brand-icon">
              <Sprout size={23} />
            </span>
            AgriMap<span className="sm-brand-pro">Pro</span>
          </a>
          <a
            className="sm-version"
            href={classicReturn}
            title="Switch to Classic UI"
          >
            {MODERN_UI_VERSION} <ArrowLeft size={12} />
          </a>
        </div>
        <div className="sm-workspace">
          <span className="sm-avatar">
            <Leaf size={20} />
          </span>
          <div>
            <b>{farmName}</b>
            <small>
              {guest
                ? "Sample workspace"
                : session
                  ? "Local farm server"
                  : "Cloud account"}
            </small>
          </div>
        </div>
        <p className="sm-nav-label">Your workspace</p>
        <nav>
          {modules.map(([key, label, Icon]) => (
            <button
              key={key}
              aria-current={page === key && !authPage ? "page" : undefined}
              onClick={() => {
                setAuthPage(null);
                go(key);
              }}
            >
              <Icon size={19} />
              <span>{t(label)}</span>
              {[
                "tasks",
                "inventory",
                "weather",
                "market",
                "analysis",
                "messages",
              ].includes(key) && (
                <span className="sm-classic-dot" title="Available in Classic" />
              )}
            </button>
          ))}
        </nav>
        <div className="sm-sidebar-bottom">
          <span className="sm-connection-dot" />
          <span>
            {checking
              ? "Checking connection…"
              : session
                ? "Farm server connected"
                : cloudUser
                  ? "Cloud account connected"
                  : "Guest preview"}
          </span>
          <a href={classicReturn}>
            Classic UI <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="sm-main-wrap">
        <header className="sm-topbar">
          <div className="sm-topbar-start">
            <button
              className="sm-icon-button sm-menu-button"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span className="sm-breadcrumb">
              Workspace <ChevronRight size={14} />{" "}
              <b>
                {authPage === "register"
                  ? "Create account"
                  : authPage === "login"
                    ? "Sign in"
                    : t(modules.find((m) => m[0] === page)![1])}
              </b>
            </span>
          </div>
          <div className="sm-topbar-tools">
            <label>
              <span className="sm-visually-hidden">Region</span>
              <select
                aria-label="Region"
                value={region}
                onChange={(e) => {
                  const next = e.target.value as typeof region;
                  setRegion(next);
                  setCurrency(defaultBillingCurrency(next, lang));
                }}
              >
                <option>Global</option>
                <option>Georgia</option>
              </select>
            </label>
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => {
                const next = e.target.value as typeof lang;
                setLang(next);
                setCurrency(defaultBillingCurrency(region, next));
              }}
            >
              <option value="en">EN</option>
              <option value="ka">ქართული</option>
            </select>
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
            >
              <option>USD</option>
              <option>GEL</option>
            </select>
            <button
              className="sm-profile"
              onClick={() => {
                if (guest) setAuthPage("login");
                else go("settings");
              }}
            >
              <span>
                {(session?.user.name || cloudUser?.name || "Guest").slice(0, 1)}
              </span>
              <b>{session?.user.name || cloudUser?.name || "Sign in"}</b>
            </button>
          </div>
        </header>
        <main id="modern-content" className="sm-main">
          {error && (
            <div className="sm-message sm-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="sm-message" role="status">
              <Check size={18} />
              {notice}
            </div>
          )}
          {authPage ? (
            <div className="sm-auth-layout">
              <section className="sm-auth-intro">
                <p className="sm-eyebrow">A clearer day on your farm</p>
                <h1>
                  {authPage === "register"
                    ? "Make room for better growing."
                    : "Welcome back to your farm."}
                </h1>
                <p>
                  Your fields, people and harvests, together in one calm
                  workspace. Choose your own farm server or connect to your
                  existing cloud account.
                </p>
                <FarmIllustration />
                <div className="sm-assurance">
                  <Check size={18} /> Same identity across Classic and Modern
                </div>
                <div className="sm-assurance">
                  <Check size={18} /> Your farm records stay where they belong
                </div>
              </section>
              <section className="sm-card sm-auth-card">
                <div className="sm-section-heading">
                  <h2>
                    {authPage === "register"
                      ? "Create your account"
                      : "Sign in"}
                  </h2>
                  <button
                    className="sm-icon-button"
                    aria-label="Close account screen"
                    onClick={() => setAuthPage(null)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="sm-segmented" aria-label="Connection type">
                  <button
                    aria-pressed={provider === "local"}
                    onClick={() => setProvider("local")}
                  >
                    <Monitor size={17} />
                    Farm server
                  </button>
                  <button
                    aria-pressed={provider === "cloud"}
                    onClick={() => setProvider("cloud")}
                  >
                    <Cloud size={17} />
                    Cloud
                  </button>
                </div>
                {authPage === "register" && provider === "local" ? (
                  <div className="sm-empty">
                    <Users size={30} />
                    <h3>Join your farm team</h3>
                    <p>
                      Ask your farm owner to create a worker account. New farm
                      owners initialize their server once on their computer.
                    </p>
                    <code>npm run local:init</code>
                    <button
                      className="sm-button sm-primary"
                      onClick={() => setAuthPage("login")}
                    >
                      I have a local account <ArrowRight size={17} />
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={submit(async (data) => {
                      let listingFailed = false;
                      if (provider === "local") {
                        await local("login", {
                          username: data.get("email"),
                          password: data.get("password"),
                        });
                        await loadLocal();
                      } else {
                        const service = await import("./cloud");
                        const account =
                          authPage === "register"
                            ? await service.cloudRegister(
                                String(data.get("name")),
                                String(data.get("email")),
                                String(data.get("password")),
                                region === "Georgia" ? "Georgia" : "",
                              )
                            : await service.cloudLogin(
                                String(data.get("email")),
                                String(data.get("password")),
                              );
                        setCloudUser(account);
                        setSession(null);
                        setFields([]);
                        setHarvests([]);
                        setUsers([]);
                        try {
                          setFarms(await service.cloudFarms());
                        } catch {
                          listingFailed = true;
                        }
                      }
                      setAuthPage(null);
                      go("overview");
                      if (listingFailed)
                        setNotice(
                          "Account connected. Farm listing could not be loaded; use Classic to continue.",
                        );
                    })}
                  >
                    {authPage === "register" && (
                      <label>
                        Your name
                        <input
                          name="name"
                          required
                          maxLength={120}
                          autoComplete="name"
                          placeholder="Your full name"
                        />
                      </label>
                    )}
                    <label>
                      {provider === "local" ? "Username" : "Email address"}
                      <input
                        name="email"
                        type={provider === "local" ? "text" : "email"}
                        required
                        autoComplete="username"
                        placeholder={
                          provider === "local"
                            ? "Your farm username"
                            : "you@example.com"
                        }
                      />
                    </label>
                    <label>
                      Password
                      <input
                        name="password"
                        type="password"
                        required
                        minLength={authPage === "register" ? 12 : 1}
                        maxLength={200}
                        autoComplete={
                          authPage === "register"
                            ? "new-password"
                            : "current-password"
                        }
                        placeholder={
                          authPage === "register"
                            ? "At least 12 characters"
                            : "Enter your password"
                        }
                      />
                    </label>
                    {authPage === "register" && (
                      <p className="sm-muted">
                        Registration creates a free account. It does not start a
                        paid plan, charge a card or grant administrator access.
                      </p>
                    )}
                    <button
                      disabled={busy}
                      className="sm-button sm-primary sm-full"
                    >
                      {busy
                        ? "Connecting…"
                        : authPage === "register"
                          ? "Create cloud account"
                          : "Sign in"}{" "}
                      <ArrowRight size={18} />
                    </button>
                  </form>
                )}
                <p className="sm-auth-footer">
                  {authPage === "login"
                    ? "New to AgriMap?"
                    : "Already have an account?"}{" "}
                  <button
                    onClick={() => {
                      setError("");
                      setAuthPage(authPage === "login" ? "register" : "login");
                    }}
                  >
                    {authPage === "login" ? "Create account" : "Sign in"}
                  </button>
                </p>
                <button
                  className="sm-text-button"
                  onClick={() => setAuthPage(null)}
                >
                  Explore the preview first <ArrowRight size={15} />
                </button>
              </section>
            </div>
          ) : (
            <>
              <div className="sm-page-heading">
                <div>
                  <p className="sm-eyebrow">
                    {guest
                      ? "Explore at your own pace"
                      : session
                        ? session.farm.timezone
                        : "Your connected account"}
                  </p>
                  <h1>
                    {page === "overview"
                      ? lang === "ka"
                        ? "თქვენი მეურნეობა, ერთ სივრცეში."
                        : "Your farm, at a glance."
                      : t(modules.find((m) => m[0] === page)![1])}
                  </h1>
                  <p>
                    {guest
                      ? "A sample workspace to explore the new interface. No real farm data is loaded."
                      : session
                        ? "Keep daily work simple. These records come from your existing farm server."
                        : "Your cloud identity is shared with Classic. Full cloud module migration is in progress."}
                  </p>
                </div>
                <div className="sm-heading-actions">
                  {session && (
                    <button
                      className="sm-button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await loadLocal();
                          setNotice("Records refreshed from farm server.");
                        })
                      }
                    >
                      <RefreshCw size={16} /> Refresh
                    </button>
                  )}
                  {["overview", "fields", "harvest"].includes(page) &&
                    !(page === "fields" && session?.user.role === "worker") &&
                    primary}
                </div>
              </div>
              {guest && (
                <div className="sm-preview-note">
                  <span>
                    <Leaf size={17} /> Sample workspace · Modern preview
                  </span>
                  <button onClick={() => setAuthPage("register")}>
                    Make it your farm <ArrowRight size={15} />
                  </button>
                </div>
              )}
              {page === "overview" && (
                <>
                  <div className="sm-stats">
                    <Stat
                      title="Managed area"
                      value={cloudUser ? "—" : area.toLocaleString()}
                      unit="ha"
                      detail={
                        cloudUser
                          ? "Open Classic for cloud field data"
                          : `${shownFields.length} fields in this workspace`
                      }
                    />
                    <Stat
                      title="Recorded harvest"
                      value={cloudUser ? "—" : total.toLocaleString()}
                      unit="kg"
                      detail={
                        guest
                          ? "Illustrative sample entries"
                          : `${shownHarvests.length} saved entries`
                      }
                    />
                    <Stat
                      title="Farm team"
                      value={
                        guest
                          ? "3"
                          : session?.user.role === "owner"
                            ? String(users.filter((u) => u.active !== 0).length)
                            : session
                              ? "—"
                              : "—"
                      }
                      detail={
                        guest
                          ? "Sample owner and two workers"
                          : session?.user.role === "worker"
                            ? "Team directory is owner-only"
                            : "Active server accounts"
                      }
                    />
                    <Stat
                      title="Connection"
                      value={
                        session ? "Local" : cloudUser ? "Cloud" : "Preview"
                      }
                      detail={
                        guest
                          ? "Sample data only"
                          : refreshed
                            ? `Refreshed ${refreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Account connected"
                      }
                    />
                  </div>
                  <div className="sm-overview-grid">
                    <section className="sm-card">
                      <div className="sm-section-heading">
                        <div>
                          <p className="sm-eyebrow">Your growing spaces</p>
                          <h2>Fields in focus</h2>
                        </div>
                        <button
                          className="sm-text-button"
                          onClick={() => go("fields")}
                        >
                          View fields <ArrowRight size={16} />
                        </button>
                      </div>
                      {guest ? (
                        <FarmIllustration />
                      ) : (
                        <div className="sm-field-overview">
                          {shownFields.length ? (
                            shownFields.slice(0, 4).map((field, i) => (
                              <div key={field.id}>
                                <span className="sm-field-number">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <div>
                                  <b>{field.name}</b>
                                  <p>{field.crop}</p>
                                </div>
                                <strong>{field.area_ha} ha</strong>
                              </div>
                            ))
                          ) : (
                            <div className="sm-empty">
                              <Map size={30} />
                              <p>
                                {cloudUser
                                  ? "Cloud workspaces stay available in Classic."
                                  : "Add the first field to begin your farm overview."}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="sm-card-foot">
                        <span>
                          {guest
                            ? "Illustrated sample layout · not real boundaries"
                            : cloudUser
                              ? `${farms.length} owned cloud workspaces loaded`
                              : "Actual local field records · boundaries not yet mapped"}
                        </span>
                      </div>
                    </section>
                    <section className="sm-card">
                      <div className="sm-section-heading">
                        <div>
                          <p className="sm-eyebrow">
                            A little structure, a better day
                          </p>
                          <h2>Quick actions</h2>
                        </div>
                        <Leaf size={22} />
                      </div>
                      <Action
                        icon={Package}
                        title="Record a harvest"
                        text="Add weight from a field"
                        onClick={() => openForm("harvest")}
                      />
                      <Action
                        icon={Map}
                        title="Manage your fields"
                        text="Keep crops and areas organized"
                        onClick={() => go("fields")}
                      />
                      <Action
                        icon={Users}
                        title="Bring your team together"
                        text="People and farm access"
                        onClick={() => go("team")}
                      />
                      <Action
                        icon={Sun}
                        title="Weather & devices"
                        text="Open the working tools in Classic"
                        onClick={() => go("weather")}
                      />
                      <div className="sm-soft-note">
                        <Wifi size={18} />
                        <p>
                          {session
                            ? "Internet can be offline while devices stay connected to the farm server."
                            : "Connect to a farm server for local work, or use your cloud account."}
                        </p>
                      </div>
                    </section>
                  </div>
                  <section className="sm-card">
                    <div className="sm-section-heading">
                      <div>
                        <p className="sm-eyebrow">Keep the season in view</p>
                        <h2>Recent harvest</h2>
                      </div>
                      <button
                        className="sm-text-button"
                        onClick={() => go("harvest")}
                      >
                        View all <ArrowRight size={16} />
                      </button>
                    </div>
                    <HarvestList
                      records={shownHarvests.slice(0, 4)}
                      timezone={session?.farm.timezone || "Asia/Tbilisi"}
                    />
                  </section>
                </>
              )}
              {page === "fields" && (
                <section className="sm-card">
                  <div className="sm-section-heading">
                    <h2>{shownFields.length} fields</h2>
                    <SearchBox value={search} onChange={setSearch} />
                  </div>
                  <div className="sm-field-grid">
                    {shownFields
                      .filter((f) =>
                        `${f.name} ${f.crop}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((field, i) => (
                        <article className="sm-field-card" key={field.id}>
                          <div className="sm-field-art">
                            <Leaf size={42} />
                            <span>{String(i + 1).padStart(2, "0")}</span>
                          </div>
                          <div>
                            <h3>{field.name}</h3>
                            <p>{field.crop}</p>
                            <div className="sm-field-card-foot">
                              <strong>
                                {field.area_ha} <small>ha</small>
                              </strong>
                              <span className="sm-chip">
                                {guest ? "Sample field" : "Farm record"}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!shownFields.length && (
                    <div className="sm-empty">
                      <Map size={32} />
                      <p>
                        {cloudUser
                          ? "Open Classic to work with your existing cloud fields."
                          : "No fields yet. Add your first field."}
                      </p>
                    </div>
                  )}
                  <p className="sm-muted">
                    {guest
                      ? "Sample field cards do not represent your plantation."
                      : "Boundary drawing and cloud field editing remain in Classic during migration."}
                  </p>
                  <a
                    className="sm-text-button"
                    href="/classic"
                    onClick={() => classicLink("fields")}
                  >
                    Open map planner in Classic <ArrowUpRight size={15} />
                  </a>
                </section>
              )}
              {page === "harvest" && (
                <section className="sm-card">
                  <div className="sm-section-heading">
                    <div>
                      <h2>Harvest records</h2>
                      <p className="sm-muted">
                        {total.toLocaleString()} kg{" "}
                        {guest ? "in this sample" : "recorded"} ·{" "}
                        {shownHarvests.length} entries
                      </p>
                    </div>
                    <span className="sm-chip">
                      {guest
                        ? "Sample data"
                        : session
                          ? "Farm server records"
                          : "Cloud view in Classic"}
                    </span>
                  </div>
                  <HarvestList
                    records={shownHarvests}
                    timezone={session?.farm.timezone || "Asia/Tbilisi"}
                  />
                  {cloudUser && (
                    <a
                      href="/classic"
                      onClick={() => classicLink("harvest")}
                      className="sm-button"
                    >
                      Open cloud harvest in Classic <ArrowUpRight size={16} />
                    </a>
                  )}
                </section>
              )}
              {page === "team" &&
                (session ? (
                  <section className="sm-card">
                    <div className="sm-section-heading">
                      <h2>Farm team</h2>
                      {session.user.role === "owner" && (
                        <button
                          className="sm-button sm-primary"
                          onClick={() => openForm("worker")}
                        >
                          <Plus size={18} />
                          Add worker
                        </button>
                      )}
                    </div>
                    {session.user.role === "owner" ? (
                      users.map((user) => (
                        <div className="sm-person" key={user.id}>
                          <span className="sm-avatar">
                            {user.name.slice(0, 1)}
                          </span>
                          <div>
                            <b>{user.name}</b>
                            <p>
                              {user.username} · {user.role}
                            </p>
                          </div>
                          <span className="sm-chip">
                            {user.active === 0 ? "Disabled" : "Active"}
                          </span>
                          {user.role === "worker" && (
                            <button
                              disabled={busy}
                              className="sm-button"
                              onClick={() =>
                                run(async () => {
                                  await local("worker-access", {
                                    id: user.id,
                                    active: !user.active,
                                  });
                                  await loadLocal();
                                  setNotice(
                                    "Worker access updated. Previous sessions were revoked.",
                                  );
                                })
                              }
                            >
                              {user.active ? "Disable" : "Enable"}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="sm-empty">
                        <Users size={30} />
                        <p>
                          The farm owner manages team membership. Your worker
                          account can record harvests.
                        </p>
                      </div>
                    )}
                  </section>
                ) : (
                  bridge("team")
                ))}
              {page === "reports" && (session || guest) ? (
                <>
                  <div className="sm-stats">
                    <Stat
                      title="Recorded weight"
                      value={total.toLocaleString()}
                      unit="kg"
                      detail="Sum of displayed harvest records"
                    />
                    <Stat
                      title="Field area"
                      value={area.toLocaleString()}
                      unit="ha"
                      detail="Sum of recorded field areas"
                    />
                  </div>
                  <section className="sm-card">
                    <h2>Harvest by field</h2>
                    {shownFields.map((field) => {
                      const weight = shownHarvests
                        .filter(
                          (h) =>
                            h.field_id === field.id ||
                            (!h.field_id && h.field_name === field.name),
                        )
                        .reduce((sum, h) => sum + h.kg, 0);
                      return (
                        <div className="sm-report-line" key={field.id}>
                          <b>{field.name}</b>
                          <div>
                            <span
                              style={{
                                width: `${total ? Math.max(0, (weight / total) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <strong>{weight.toLocaleString()} kg</strong>
                        </div>
                      );
                    })}
                    <p className="sm-muted">
                      These totals do not infer yield per hectare, expenses or
                      annual performance. Advanced reporting remains in Classic.
                    </p>
                  </section>
                </>
              ) : null}
              {page === "plans" && (
                <section className="sm-card">
                  <div className="sm-section-heading">
                    <div>
                      <p className="sm-eyebrow">
                        A plan that grows with your farm
                      </p>
                      <h2>One workspace. Your whole team.</h2>
                    </div>
                  </div>
                  <p className="sm-muted">
                    Draft prices per farm. No checkout is enabled. USD and GEL
                    are independent proposed tariffs.
                  </p>
                  <div className="sm-plan-grid">
                    {PROPOSED_PLANS.map((plan) => (
                      <article className="sm-plan" key={plan.id}>
                        <span className="sm-chip">
                          {plan.id === "pro"
                            ? "For growing teams"
                            : plan.id === "trial"
                              ? "Try it first"
                              : "Per farm"}
                        </span>
                        <h3>{plan.name}</h3>
                        <p className="sm-plan-price">
                          {plan.contactRequired
                            ? "Let’s talk"
                            : plan.freeDays
                              ? "14 days"
                              : formatPlanPrice(plan, currency, lang)}
                          {!plan.contactRequired && !plan.freeDays && (
                            <small>/ month</small>
                          )}
                        </p>
                        <ul>
                          {plan.features.map((f) => (
                            <li key={f}>
                              <Check size={16} />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <a
                          className="sm-button"
                          href={guest ? "/modern/register" : "/classic"}
                          onClick={() => classicLink("plans")}
                        >
                          {guest
                            ? "Create an account"
                            : "Review plans in Classic"}
                          <ArrowRight size={16} />
                        </a>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {page === "settings" && (
                <section className="sm-card">
                  <h2>Your workspace preferences</h2>
                  <p className="sm-muted">
                    Modern is a separate interface. Theme and layout changes
                    here do not overwrite Classic preferences.
                  </p>
                  <div className="sm-settings-row">
                    <div>
                      <b>Interface version</b>
                      <p>{MODERN_UI_VERSION} · first preview</p>
                    </div>
                    <a className="sm-button" href={classicReturn}>
                      Switch to Classic <ArrowLeft size={16} />
                    </a>
                  </div>
                  <div className="sm-settings-row">
                    <div>
                      <b>Account</b>
                      <p>
                        {session
                          ? `${session.user.name} · ${session.user.role}`
                          : cloudUser
                            ? cloudUser.email
                            : "Guest preview · sample records"}
                      </p>
                    </div>
                    {guest ? (
                      <button
                        className="sm-button"
                        onClick={() => setAuthPage("login")}
                      >
                        Sign in
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        className="sm-button"
                        onClick={signout}
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    )}
                  </div>
                  {session?.user.role === "owner" && (
                    <div className="sm-settings-row">
                      <div>
                        <b>Farm data export</b>
                        <p>
                          Uses the existing authenticated local export. Full
                          recovery uses the SQLite backup command.
                        </p>
                      </div>
                      <a className="sm-button" href="/api/local/export">
                        <Download size={16} />
                        Export data
                      </a>
                    </div>
                  )}
                  <a
                    className="sm-text-button"
                    href={session ? "/local" : "/classic"}
                  >
                    Open existing account controls <ArrowUpRight size={16} />
                  </a>
                  <div className="sm-soft-note">
                    <Shield size={20} />
                    <p>
                      Advanced account and platform controls remain in the
                      existing interface until migrated.
                    </p>
                  </div>
                </section>
              )}
              {([
                "tasks",
                "inventory",
                "weather",
                "market",
                "analysis",
                "messages",
              ].includes(page) ||
                (page === "reports" && cloudUser)) &&
                bridge(page)}
              <footer className="sm-footer">
                <span>
                  <Sprout size={15} /> AgriMap · {MODERN_UI_VERSION}
                </span>
                <span>
                  Modern preview ·{" "}
                  <a href={classicReturn}>Classic remains available</a>
                </span>
              </footer>
            </>
          )}
        </main>
        <nav className="sm-bottom-nav" aria-label="Mobile navigation">
          {modules
            .filter((m) =>
              ["overview", "fields", "harvest", "team", "settings"].includes(
                m[0],
              ),
            )
            .map(([key, label, Icon]) => (
              <button
                key={key}
                aria-current={page === key ? "page" : undefined}
                onClick={() => {
                  setAuthPage(null);
                  go(key);
                }}
              >
                <Icon size={21} />
                <span>
                  {key === "overview"
                    ? "Home"
                    : key === "fields"
                      ? "Fields"
                      : key === "harvest"
                        ? "Harvest"
                        : key === "team"
                          ? "Team"
                          : "More"}
                </span>
              </button>
            ))}
        </nav>
      </div>
      {form && (
        <div
          className="sm-modal-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) setForm(null);
            if (event.key === "Tab") {
              const items = formRef.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input,select,a[href]",
              );
              if (!items?.length) return;
              const first = items[0],
                last = items[items.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <section
            className="sm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modern-form-title"
          >
            <form
              ref={formRef}
              onSubmit={submit(async (data) => {
                if (form === "field")
                  await local("fields", {
                    name: data.get("name"),
                    crop: data.get("crop"),
                    area_ha: Number(data.get("area")),
                  });
                if (form === "harvest")
                  await local("harvests", {
                    field_id: data.get("field"),
                    kg: Number(data.get("kg")),
                    request_id: requestId,
                  });
                if (form === "worker")
                  await local("users", {
                    name: data.get("name"),
                    username: data.get("username"),
                    password: data.get("password"),
                  });
                setForm(null);
                setNotice("Saved on farm server.");
                try {
                  await loadLocal();
                } catch {
                  setError(
                    "Saved successfully, but refreshing records failed. Refresh when the server is reachable.",
                  );
                }
              })}
            >
              <div className="sm-section-heading">
                <div>
                  <p className="sm-eyebrow">{session?.farm.name}</p>
                  <h2 id="modern-form-title">
                    {form === "field"
                      ? "Add a field"
                      : form === "worker"
                        ? "Add a worker"
                        : "Record harvest"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="sm-icon-button"
                  disabled={busy}
                  aria-label="Close form"
                  onClick={() => setForm(null)}
                >
                  <X size={21} />
                </button>
              </div>
              {error && (
                <p className="sm-message sm-error" role="alert">
                  {error}
                </p>
              )}
              {form === "field" ? (
                <>
                  <label>
                    Field name
                    <input
                      name="name"
                      required
                      maxLength={120}
                      placeholder="For example, North orchard"
                    />
                  </label>
                  <label>
                    Crop or variety
                    <input
                      name="crop"
                      required
                      maxLength={120}
                      placeholder="For example, Blueberry"
                    />
                  </label>
                  <label>
                    Area (ha)
                    <input
                      name="area"
                      type="number"
                      inputMode="decimal"
                      min="0.0001"
                      max="100000"
                      step="any"
                      required
                      placeholder="0.00"
                    />
                  </label>
                </>
              ) : form === "worker" ? (
                <>
                  <label>
                    Worker name
                    <input
                      name="name"
                      required
                      maxLength={120}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Worker username
                    <input
                      name="username"
                      required
                      maxLength={80}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Initial password
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={200}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <p className="sm-muted">
                    Share credentials privately. Workers cannot manage accounts
                    or create fields.
                  </p>
                </>
              ) : (
                <>
                  <label>
                    Field
                    <select aria-label="Harvest field" name="field" required>
                      <option value="">Choose a field</option>
                      {fields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Harvest weight (kg)
                    <input
                      name="kg"
                      type="number"
                      inputMode="decimal"
                      min="0.001"
                      max="1000000"
                      step="any"
                      required
                      placeholder="0.00"
                    />
                  </label>
                  <p className="sm-muted">
                    The server confirms the save. If a response is interrupted,
                    retry the same entry before editing it.
                  </p>
                </>
              )}
              <div className="sm-modal-actions">
                <button
                  type="button"
                  disabled={busy}
                  className="sm-button"
                  onClick={() => setForm(null)}
                >
                  Cancel
                </button>
                <button
                  disabled={busy || (form === "harvest" && !fields.length)}
                  className="sm-button sm-primary"
                >
                  {busy
                    ? "Saving…"
                    : form === "field"
                      ? "Save field"
                      : form === "worker"
                        ? "Create worker"
                        : "Save harvest"}
                  <Check size={18} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  unit,
  detail,
}: {
  title: string;
  value: string;
  unit?: string;
  detail: string;
}) {
  return (
    <article className="sm-stat">
      <p>{title}</p>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <span>{detail}</span>
    </article>
  );
}
function Action({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className="sm-action" onClick={onClick}>
      <span className="sm-icon-tile">
        <Icon size={20} />
      </span>
      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="sm-search">
      <Search size={18} />
      <input
        aria-label="Search fields"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search fields"
      />
    </label>
  );
}
function HarvestList({
  records,
  timezone,
}: {
  records: Harvest[];
  timezone: string;
}) {
  return records.length ? (
    <div className="sm-harvest-list">
      <div className="sm-harvest-head">
        <span>Field / recorded by</span>
        <span>Saved at</span>
        <span>Weight</span>
      </div>
      {records.map((record) => (
        <article className="sm-harvest-row" key={record.id}>
          <span className="sm-icon-tile">
            <Package size={20} />
          </span>
          <div>
            <b>{record.field_name}</b>
            <small>{record.recorded_by}</small>
          </div>
          <time>
            {new Date(record.recorded_at).toLocaleString(undefined, {
              timeZone: timezone,
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          <strong>
            {record.kg.toLocaleString()} <small>kg</small>
          </strong>
        </article>
      ))}
    </div>
  ) : (
    <div className="sm-empty">
      <Package size={30} />
      <p>No harvest entries loaded. Saved entries will appear here.</p>
    </div>
  );
}
function FarmIllustration() {
  return (
    <svg
      className="sm-farm-art"
      viewBox="0 0 720 300"
      role="img"
      aria-label="Illustration of sample farm fields, not actual boundaries"
    >
      <defs>
        <pattern
          id="sonik-rows"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-20)"
        >
          <path d="M0 0V14" stroke="#809d70" strokeWidth="3" opacity=".35" />
        </pattern>
      </defs>
      <rect width="720" height="300" rx="12" fill="#f0f1e7" />
      <path
        d="M0 255 Q150 200 300 280 T720 230"
        fill="none"
        stroke="#bad1ce"
        strokeWidth="20"
      />
      <path
        d="M340 0L310 300M0 151L720 170"
        stroke="#fffdf8"
        strokeWidth="16"
      />
      <path d="M28 26L305 20L294 129L30 130Z" fill="#c9d8b8" />
      <path d="M28 26L305 20L294 129L30 130Z" fill="url(#sonik-rows)" />
      <path d="M371 26L680 40L670 143L357 130Z" fill="#dce4cc" />
      <path d="M371 26L680 40L670 143L357 130Z" fill="url(#sonik-rows)" />
      <path d="M30 180L288 181L278 238L95 253Z" fill="#ddd9b9" />
      <rect x="495" y="207" width="105" height="48" rx="7" fill="#b9c5ad" />
      <text x="62" y="76">
        North orchard
      </text>
      <text x="393" y="85">
        East vineyard
      </text>
      <text x="60" y="213">
        South field
      </text>
      <text x="495" y="278">
        Packing station
      </text>
    </svg>
  );
}
