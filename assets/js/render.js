/*
 * render.js
 * Turns a JSON Resume object (https://jsonresume.org/schema/) into semantic,
 * ATS-friendly HTML. Pure functions only: no DOM side effects outside of the
 * fragment that is returned/attached. All user-provided strings are inserted as
 * text nodes (never innerHTML) to avoid HTML/script injection.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Small DOM helpers                                                   */
  /* ------------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== "") node.textContent = String(text);
    return node;
  }

  function isNonEmpty(value) {
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  // Normalize a possibly-unsafe URL. Only http(s) and mailto are allowed as
  // links; anything else is rendered as plain text.
  function safeHref(url) {
    if (typeof url !== "string") return null;
    var trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^mailto:/i.test(trimmed)) return trimmed;
    if (/^tel:/i.test(trimmed)) return trimmed;
    return null;
  }

  function anchor(text, url, className) {
    var href = safeHref(url);
    var label = text != null && text !== "" ? String(text) : href;
    if (!href) {
      // Render as text if not a safe link.
      var span = el("span", className);
      span.textContent = label != null ? String(label) : "";
      return span;
    }
    var a = el("a", className, label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  // Format an ISO-ish date (YYYY, YYYY-MM, YYYY-MM-DD) into "Mon YYYY".
  function formatDate(value) {
    if (!isNonEmpty(value)) return "";
    var str = String(value).trim();
    var match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(str);
    if (!match) return str;
    var year = match[1];
    var month = match[2] ? parseInt(match[2], 10) : null;
    var months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    if (month && month >= 1 && month <= 12) {
      return months[month - 1] + " " + year;
    }
    return year;
  }

  function dateRange(startDate, endDate) {
    var start = formatDate(startDate);
    var end = isNonEmpty(endDate) ? formatDate(endDate) : (isNonEmpty(startDate) ? "Present" : "");
    if (start && end) return start + " \u2013 " + end;
    return start || end || "";
  }

  function appendIf(parent, node) {
    if (node) parent.appendChild(node);
    return parent;
  }

  /* ------------------------------------------------------------------ */
  /* Section building blocks                                            */
  /* ------------------------------------------------------------------ */

  function section(title, id) {
    var sec = el("section", "resume-section");
    if (id) sec.id = "section-" + id;
    if (isNonEmpty(title)) {
      sec.appendChild(el("h2", "resume-section__title", title));
    }
    return sec;
  }

  // A single "entry" (job, degree, project, ...) with a header row.
  function entryHeader(primary, secondary, meta, subMeta) {
    var header = el("div", "entry__header");
    var main = el("div", "entry__headline");
    if (isNonEmpty(primary)) main.appendChild(el("h3", "entry__title", primary));
    if (isNonEmpty(secondary)) main.appendChild(el("span", "entry__subtitle", secondary));
    header.appendChild(main);

    var right = el("div", "entry__meta");
    if (isNonEmpty(meta)) right.appendChild(el("span", "entry__dates", meta));
    if (isNonEmpty(subMeta)) right.appendChild(el("span", "entry__location", subMeta));
    if (right.childNodes.length) header.appendChild(right);

    return header;
  }

  function bulletList(items, className) {
    if (!Array.isArray(items) || !items.length) return null;
    var ul = el("ul", className || "bullet-list");
    items.forEach(function (item) {
      if (isNonEmpty(item)) ul.appendChild(el("li", null, item));
    });
    return ul.childNodes.length ? ul : null;
  }

  function keywordList(keywords) {
    if (!Array.isArray(keywords) || !keywords.length) return null;
    var wrap = el("ul", "tag-list");
    keywords.forEach(function (kw) {
      if (isNonEmpty(kw)) wrap.appendChild(el("li", "tag", kw));
    });
    return wrap.childNodes.length ? wrap : null;
  }

  /* ------------------------------------------------------------------ */
  /* Header / basics                                                    */
  /* ------------------------------------------------------------------ */

  function renderBasics(basics) {
    if (!basics || typeof basics !== "object") return null;
    var header = el("header", "resume-header");

    var identity = el("div", "resume-header__identity");
    if (isNonEmpty(basics.name)) identity.appendChild(el("h1", "resume-name", basics.name));
    if (isNonEmpty(basics.label)) identity.appendChild(el("p", "resume-label", basics.label));
    header.appendChild(identity);

    // Contact line — plain, comma-free structure that ATS parsers read well.
    var contact = el("ul", "contact-list");

    var location = basics.location || {};
    var locBits = [location.address, location.city, location.region, location.postalCode, location.countryCode]
      .filter(isNonEmpty);
    if (locBits.length) {
      contact.appendChild(el("li", "contact-item", locBits.join(", ")));
    }
    if (isNonEmpty(basics.email)) {
      var emailLi = el("li", "contact-item");
      emailLi.appendChild(anchor(basics.email, "mailto:" + basics.email, "contact-link"));
      contact.appendChild(emailLi);
    }
    if (isNonEmpty(basics.phone)) {
      var phoneLi = el("li", "contact-item");
      var telHref = "tel:" + String(basics.phone).replace(/[^+\d]/g, "");
      phoneLi.appendChild(anchor(basics.phone, telHref, "contact-link"));
      contact.appendChild(phoneLi);
    }
    if (isNonEmpty(basics.url)) {
      var urlLi = el("li", "contact-item");
      urlLi.appendChild(anchor(basics.url.replace(/^https?:\/\//i, ""), basics.url, "contact-link"));
      contact.appendChild(urlLi);
    }

    if (Array.isArray(basics.profiles)) {
      basics.profiles.forEach(function (profile) {
        if (!profile) return;
        var label = isNonEmpty(profile.network)
          ? (isNonEmpty(profile.username) ? profile.network + ": " + profile.username : profile.network)
          : profile.username;
        if (!isNonEmpty(label) && !isNonEmpty(profile.url)) return;
        var li = el("li", "contact-item");
        li.appendChild(anchor(label || profile.url, profile.url, "contact-link"));
        contact.appendChild(li);
      });
    }

    if (contact.childNodes.length) header.appendChild(contact);

    if (isNonEmpty(basics.summary)) {
      var summary = section("Summary", "summary");
      summary.appendChild(el("p", "resume-summary", basics.summary));
      header.appendChild(summary);
    }

    return header;
  }

  /* ------------------------------------------------------------------ */
  /* Work / volunteer                                                   */
  /* ------------------------------------------------------------------ */

  function renderWork(work) {
    if (!Array.isArray(work) || !work.length) return null;
    var sec = section("Experience", "work");
    work.forEach(function (job) {
      if (!job) return;
      var entry = el("article", "entry");
      var org = job.name || job.company; // schema evolved from "company" to "name"
      entry.appendChild(entryHeader(
        job.position,
        org,
        dateRange(job.startDate, job.endDate),
        job.location
      ));
      if (isNonEmpty(job.url)) {
        var link = el("p", "entry__link");
        link.appendChild(anchor(job.url.replace(/^https?:\/\//i, ""), job.url));
        entry.appendChild(link);
      }
      if (isNonEmpty(job.summary)) entry.appendChild(el("p", "entry__summary", job.summary));
      appendIf(entry, bulletList(job.highlights));
      appendIf(entry, keywordList(job.keywords));
      sec.appendChild(entry);
    });
    return sec;
  }

  function renderVolunteer(volunteer) {
    if (!Array.isArray(volunteer) || !volunteer.length) return null;
    var sec = section("Volunteer", "volunteer");
    volunteer.forEach(function (item) {
      if (!item) return;
      var entry = el("article", "entry");
      entry.appendChild(entryHeader(
        item.position,
        item.organization,
        dateRange(item.startDate, item.endDate),
        null
      ));
      if (isNonEmpty(item.summary)) entry.appendChild(el("p", "entry__summary", item.summary));
      appendIf(entry, bulletList(item.highlights));
      sec.appendChild(entry);
    });
    return sec;
  }

  /* ------------------------------------------------------------------ */
  /* Education                                                          */
  /* ------------------------------------------------------------------ */

  function renderEducation(education) {
    if (!Array.isArray(education) || !education.length) return null;
    var sec = section("Education", "education");
    education.forEach(function (edu) {
      if (!edu) return;
      var entry = el("article", "entry");
      var degree = [edu.studyType, edu.area].filter(isNonEmpty).join(", ");
      entry.appendChild(entryHeader(
        degree || edu.area || edu.studyType,
        edu.institution,
        dateRange(edu.startDate, edu.endDate),
        isNonEmpty(edu.score) ? "GPA " + edu.score : null
      ));
      appendIf(entry, bulletList(edu.courses));
      sec.appendChild(entry);
    });
    return sec;
  }

  /* ------------------------------------------------------------------ */
  /* Projects                                                           */
  /* ------------------------------------------------------------------ */

  function renderProjects(projects) {
    if (!Array.isArray(projects) || !projects.length) return null;
    var sec = section("Projects", "projects");
    projects.forEach(function (project) {
      if (!project) return;
      var entry = el("article", "entry");
      var role = [project.entity, project.type].filter(isNonEmpty).join(" \u00b7 ");
      entry.appendChild(entryHeader(
        project.name,
        role,
        dateRange(project.startDate, project.endDate),
        null
      ));
      if (isNonEmpty(project.url)) {
        var link = el("p", "entry__link");
        link.appendChild(anchor(project.url.replace(/^https?:\/\//i, ""), project.url));
        entry.appendChild(link);
      }
      if (isNonEmpty(project.description)) entry.appendChild(el("p", "entry__summary", project.description));
      appendIf(entry, bulletList(project.highlights));
      appendIf(entry, keywordList(project.keywords));
      sec.appendChild(entry);
    });
    return sec;
  }

  /* ------------------------------------------------------------------ */
  /* Skills / languages / interests                                     */
  /* ------------------------------------------------------------------ */

  function renderSkills(skills) {
    if (!Array.isArray(skills) || !skills.length) return null;
    var sec = section("Skills", "skills");
    var list = el("dl", "definition-list");
    skills.forEach(function (skill) {
      if (!skill) return;
      var name = skill.name;
      var detailBits = [];
      if (isNonEmpty(skill.level)) detailBits.push(skill.level);
      if (Array.isArray(skill.keywords) && skill.keywords.length) {
        detailBits.push(skill.keywords.filter(isNonEmpty).join(", "));
      }
      if (!isNonEmpty(name) && !detailBits.length) return;
      list.appendChild(el("dt", "definition-term", name || ""));
      list.appendChild(el("dd", "definition-desc", detailBits.join(" \u2014 ")));
    });
    if (!list.childNodes.length) return null;
    sec.appendChild(list);
    return sec;
  }

  function renderLanguages(languages) {
    if (!Array.isArray(languages) || !languages.length) return null;
    var sec = section("Languages", "languages");
    var list = el("dl", "definition-list");
    languages.forEach(function (lang) {
      if (!lang) return;
      if (!isNonEmpty(lang.language) && !isNonEmpty(lang.fluency)) return;
      list.appendChild(el("dt", "definition-term", lang.language || ""));
      list.appendChild(el("dd", "definition-desc", lang.fluency || ""));
    });
    if (!list.childNodes.length) return null;
    sec.appendChild(list);
    return sec;
  }

  function renderInterests(interests) {
    if (!Array.isArray(interests) || !interests.length) return null;
    var sec = section("Interests", "interests");
    var list = el("dl", "definition-list");
    interests.forEach(function (interest) {
      if (!interest) return;
      var detail = Array.isArray(interest.keywords)
        ? interest.keywords.filter(isNonEmpty).join(", ")
        : "";
      if (!isNonEmpty(interest.name) && !detail) return;
      list.appendChild(el("dt", "definition-term", interest.name || ""));
      list.appendChild(el("dd", "definition-desc", detail));
    });
    if (!list.childNodes.length) return null;
    sec.appendChild(list);
    return sec;
  }

  /* ------------------------------------------------------------------ */
  /* Awards / certificates / publications / references                 */
  /* ------------------------------------------------------------------ */

  function renderAwards(awards) {
    if (!Array.isArray(awards) || !awards.length) return null;
    var sec = section("Awards", "awards");
    awards.forEach(function (award) {
      if (!award) return;
      var entry = el("article", "entry");
      entry.appendChild(entryHeader(
        award.title,
        award.awarder,
        formatDate(award.date),
        null
      ));
      if (isNonEmpty(award.summary)) entry.appendChild(el("p", "entry__summary", award.summary));
      sec.appendChild(entry);
    });
    return sec;
  }

  function renderCertificates(certificates) {
    if (!Array.isArray(certificates) || !certificates.length) return null;
    var sec = section("Certificates", "certificates");
    certificates.forEach(function (cert) {
      if (!cert) return;
      var entry = el("article", "entry");
      entry.appendChild(entryHeader(
        cert.name,
        cert.issuer,
        formatDate(cert.date),
        null
      ));
      if (isNonEmpty(cert.url)) {
        var link = el("p", "entry__link");
        link.appendChild(anchor(cert.url.replace(/^https?:\/\//i, ""), cert.url));
        entry.appendChild(link);
      }
      sec.appendChild(entry);
    });
    return sec;
  }

  function renderPublications(publications) {
    if (!Array.isArray(publications) || !publications.length) return null;
    var sec = section("Publications", "publications");
    publications.forEach(function (pub) {
      if (!pub) return;
      var entry = el("article", "entry");
      entry.appendChild(entryHeader(
        pub.name,
        pub.publisher,
        formatDate(pub.releaseDate),
        null
      ));
      if (isNonEmpty(pub.url)) {
        var link = el("p", "entry__link");
        link.appendChild(anchor(pub.url.replace(/^https?:\/\//i, ""), pub.url));
        entry.appendChild(link);
      }
      if (isNonEmpty(pub.summary)) entry.appendChild(el("p", "entry__summary", pub.summary));
      sec.appendChild(entry);
    });
    return sec;
  }

  function renderReferences(references) {
    if (!Array.isArray(references) || !references.length) return null;
    var sec = section("References", "references");
    references.forEach(function (ref) {
      if (!ref) return;
      if (!isNonEmpty(ref.name) && !isNonEmpty(ref.reference)) return;
      var entry = el("article", "entry entry--reference");
      if (isNonEmpty(ref.reference)) {
        entry.appendChild(el("blockquote", "reference-quote", ref.reference));
      }
      if (isNonEmpty(ref.name)) entry.appendChild(el("p", "reference-name", "\u2014 " + ref.name));
      sec.appendChild(entry);
    });
    return sec;
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  // Order chosen to match what recruiters/ATS expect most.
  var SECTION_RENDERERS = [
    function (r) { return renderWork(r.work); },
    function (r) { return renderEducation(r.education); },
    function (r) { return renderProjects(r.projects); },
    function (r) { return renderSkills(r.skills); },
    function (r) { return renderVolunteer(r.volunteer); },
    function (r) { return renderAwards(r.awards); },
    function (r) { return renderCertificates(r.certificates); },
    function (r) { return renderPublications(r.publications); },
    function (r) { return renderLanguages(r.languages); },
    function (r) { return renderInterests(r.interests); },
    function (r) { return renderReferences(r.references); }
  ];

  // Returns a document fragment representing the whole resume.
  function renderResume(resume) {
    if (!resume || typeof resume !== "object") {
      throw new Error("Resume data must be a JSON object.");
    }

    var fragment = document.createDocumentFragment();
    var article = el("article", "resume-document");

    var basics = renderBasics(resume.basics);
    if (basics) article.appendChild(basics);

    SECTION_RENDERERS.forEach(function (build) {
      var node = build(resume);
      if (node) article.appendChild(node);
    });

    fragment.appendChild(article);
    return fragment;
  }

  global.ResumeRenderer = {
    render: renderResume,
    formatDate: formatDate,
    dateRange: dateRange
  };
})(window);
