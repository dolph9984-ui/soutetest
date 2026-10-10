/* API d'aperçu Vite, volontairement limitée au mode isolé « admin-preview ».
 * Aucun appel Laravel, aucune base SQL, aucun fichier métier réel n'est modifié.
 * Les modifications restent en mémoire du serveur et le redémarrage les efface.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { basename, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Plugin, ViteDevServer } from 'vite';

type Row = Record<string, any>;
type Dataset = {
  lands: Row[];
  clients: Row[];
  requests: Row[];
  searches: Row[];
  landFiles: Row[];
  messages: Row[];
  realisations: Row[];
  presentationAllowed: boolean;
};
const user = {
  id: '1',
  name: 'Équipe CA IMMO',
  email: 'validation@caimmo.example',
};
const password = 'apercu-ca-immo';

export function adminPreviewPlugin(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'config' | 'middlewares'>) => {
    const root = server.config.root;
    const source = resolve(root, '../backend/database/seeders');
    const attachments = new Map<
      string,
      { content: Buffer; name: string; type: string; public?: boolean }
    >();
    const sessions = new Set<string>();
    const base = new Date();
    base.setHours(9, 0, 0, 0);
    const at = (offset = 0, time = '09:00') => {
      const date = new Date(base);
      date.setDate(date.getDate() + offset);
      const [h, m] = time.split(':').map(Number);
      date.setHours(h, m, 0, 0);
      return date.toISOString();
    };
    const ref = (prefix: string, i: number) =>
      `${prefix}-${base.toISOString().slice(2, 10).replaceAll('-', '')}${i > 0 ? `-${i + 1}` : ''}`;
    const entry = (
      key: string,
      text: string,
      offset = 0,
      author = 'Équipe CA IMMO',
    ) => ({ id: `preview-${key}`, at: at(offset), text, author });
    const file = (path: string, name?: string) => {
      const id = `fixture-${path.replaceAll('/', '_')}`;
      const content = readFileSync(resolve(source, 'fixtures', path));
      attachments.set(id, {
        content,
        name: basename(path),
        type: 'application/pdf',
      });
      return {
        id,
        name: name ?? basename(path),
        size: content.length,
        type: 'application/pdf',
        url: `/api/v1/admin/files/${id}`,
      };
    };
    const photo = (url: string) => ({
      id: `photo-${url.replaceAll('/', '_')}`,
      name: basename(url),
      type: 'image/jpeg',
      size: statSync(resolve(root, 'public' + url)).size,
      url,
    });
    const person = (p: Row) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      dialCode: '',
      phone: p.phone,
      email: p.email,
      birthDate: p.birthDate,
      profession: p.profession,
      country: p.country,
      countryOther: '',
      address: p.address,
      hasBankAccount: /^(oui|non)$/i.test(p.bankAccount ?? '')
        ? /^non$/i.test(p.bankAccount)
          ? 'Non'
          : 'Oui'
        : '',
      bank: '',
    });
    const seed = (): Dataset => {
      attachments.clear();
      const input: Row = JSON.parse(
        readFileSync(resolve(source, 'data/presentation.json'), 'utf8'),
      );
      const landSource: Row[] = JSON.parse(
        readFileSync(resolve(source, 'data/lands.json'), 'utf8'),
      );
      const landMap = new Map<string, Row>();
      const lands = landSource.map((l, i) => {
        const { presentationKey, documentFixtures, ...data } = l;
        const record = {
          ...data,
          id: String(i + 1),
          documents: documentFixtures.map((d: Row) => file(d.path, d.name)),
          lots: (l.lots ?? []).map((lot: Row) => ({
            ...lot,
            history: (lot.history ?? []).map((h: Row) => ({
              ...h,
              at: at(h.dayOffset),
            })),
          })),
          sales: [],
        };
        landMap.set(presentationKey, record);
        return record;
      });
      const people = new Map<string, Row>(
        input.people.map((p: Row) => [p.key, p]),
      );
      const clientMap = new Map<string, Row>();
      const clients = input.people.map((p: Row, i: number) => {
        const record = {
          id: String(i + 1),
          ref: ref('CLI', i),
          createdAt: at(-45),
          fullName: `${p.firstName} ${p.lastName}`,
          phone: p.phone,
          email: p.email,
          budget: p.budget ? String(p.budget) : '',
          profession: p.profession,
          age: String(base.getFullYear() - Number(p.birthDate.slice(0, 4))),
          nationality: 'Malgache',
          bankAccount: p.bankAccount,
          message: p.message,
          source: p.source,
        };
        clientMap.set(p.key, record);
        return record;
      });
      let buyIndex = 0,
        visitIndex = 0;
      const requests = input.requests.map((r: Row, i: number) => {
        const p = people.get(r.clientKey)!,
          c = clientMap.get(r.clientKey)!,
          l = landMap.get(r.landKey)!;
        const visit =
          typeof r.visitOffset === 'number'
            ? at(r.visitOffset, r.visitTime ?? '10:00')
            : '';
        const follow =
          typeof r.followUpOffset === 'number'
            ? at(r.followUpOffset, '10:30')
            : '';
        const visitAction = {
          id: `preview-${r.key}-visit`,
          type: 'Visite du terrain',
          at: visit,
          note: r.message,
          done: r.status === 'Effectuée',
          result:
            r.status === 'Effectuée'
              ? 'Visite effectuée dans le scénario.'
              : '',
        };
        const record: Row = {
          ...person(p),
          id: String(i + 1),
          ref: ref(
            r.kind === 'visite' ? 'VIS' : 'ACH',
            r.kind === 'visite' ? visitIndex++ : buyIndex++,
          ),
          createdAt: at(r.createdOffset),
          updatedAt: at(-1, '16:00'),
          source: p.source,
          kind: r.kind,
          clientId: c.id,
          landId: l.id,
          lotId: r.lotId,
          paymentMode: r.paymentMode,
          budgetMin: r.budgetMin,
          budgetMax: r.budgetMax,
          deposit: r.deposit,
          paymentDuration: r.paymentDuration,
          propertyType: 'Terrain',
          region: l.region,
          district: 'Antananarivo',
          commune: l.zone,
          fokontany: '',
          areaMin: r.areaMin,
          areaMax: r.areaMax,
          criteria: r.criteria,
          goal: r.goal,
          deadline: 'Dans les six prochains mois',
          extraInfo: 'Scénario fictif ; aucun paiement réel.',
          consent: true,
          agent: r.agent,
          priority: r.priority,
          status: r.status,
          nextFollowUp: follow,
          visitAt: visit,
          visitDate: visit ? visit.slice(0, 10) : '',
          visitTime: r.visitTime ?? '',
          callTime: 'En journée',
          message: r.message,
          notes: [entry(r.key + '-note', r.message, -1, r.agent)],
          contacts: [
            {
              id: 'contact-' + r.key,
              at: at(r.createdOffset + 1),
              channel: 'Appel',
              summary: r.contactSummary,
            },
          ],
          attachments: [
            file(
              r.documentPath,
              r.kind === 'visite'
                ? 'Préparation de la visite'
                : 'Synthèse du projet d’achat',
            ),
          ],
          history: r.history.map((text: string, n: number) =>
            entry(r.key + '-' + n, text, r.createdOffset + n, r.agent),
          ),
          actions:
            r.kind === 'visite' && visit
              ? [visitAction]
              : follow
                ? [
                    {
                      id: 'follow-' + r.key,
                      type: 'Appel',
                      at: follow,
                      note: 'Faire le point sur le projet.',
                      done: false,
                    },
                  ]
                : [],
        };
        if (r.salePrice)
          l.sales.push({
            id: 'sale-' + r.key,
            date: at(r.soldOffset).slice(0, 10),
            lotId: r.lotId,
            price: r.salePrice,
            paymentMode: r.paymentMode,
            buyer: {
              firstName: p.firstName,
              lastName: p.lastName,
              phone: p.phone,
              email: p.email,
              address: p.address,
              idNumber: 'Non fourni — exemple',
            },
            notes: 'Scénario fictif sans acte ni paiement réel.',
            buyRequestId: record.id,
          });
        return record;
      });
      const searches = input.searches.map((r: Row, i: number) => {
        const c = clientMap.get(r.clientKey)!;
        return {
          ...r,
          id: String(i + 1),
          ref: ref('REC', i),
          createdAt: at(r.createdOffset),
          source: 'Backoffice',
          clientId: c.id,
          fullName: c.fullName,
          phone: c.phone,
          email: c.email,
          attachments: [file(r.documentPath, 'Cahier de recherche')],
          proposals: r.proposalLandKeys.map((key: string, n: number) => ({
            id: `proposal-${i}-${n}`,
            landId: landMap.get(key)!.id,
            at: at(-1),
            note: 'Terrain proposé selon les critères.',
            answer: 'En attente',
          })),
          history: [
            entry(
              'search-' + i,
              'Recherche qualifiée et rattachée au client.',
              r.createdOffset,
            ),
          ],
        };
      });
      const landFiles = input.sellers.map((r: Row, i: number) => {
        const p = people.get(r.clientKey)!,
          c = clientMap.get(r.clientKey)!,
          l = landMap.get(r.landKey)!;
        return {
          id: String(i + 1),
          ref: ref('VEN', i),
          createdAt: at(r.createdOffset),
          updatedAt: at(-1),
          clientId: c.id,
          ownerId: 'EX-PROP-' + p.key,
          owner: { ...person(p), accountNumber: '' },
          idDoc: {
            type: 'Autre',
            number: 'EX-PROFIL-' + p.key,
            issuedAt: at().slice(0, 10),
            expiresAt: '',
            authority: 'Profil de présentation — pas une pièce d’identité',
            file: file(r.profilePath, 'Profil du propriétaire — exemple'),
          },
          title: l.title,
          category:
            r.landKey === 'brickaville' ? 'Terrain agricole' : 'Terrain nu',
          area: l.area,
          price: l.price,
          pricePerM2: Math.round(l.price / l.area),
          pricePerM2Manual: false,
          negotiable: 'Oui',
          description: l.description,
          relief: l.relief === 'Plat' ? 'Terrain plat' : 'Pente douce',
          accesses: [l.access],
          roadWidth: '4 m (hypothèse)',
          distanceMainRoad: '300 m (hypothèse)',
          water: l.water ? 'À proximité' : 'Non',
          electricity: l.electricity ? 'À proximité' : 'Non',
          mobile: 'Oui',
          internet: 'Oui',
          sanitation: 'À prévoir',
          fence: 'Non',
          building: 'Non',
          buildingDesc: '',
          occupation: 'Libre',
          immediate: 'Oui',
          usage: 'Résidentiel',
          region: l.region,
          regionOther: '',
          district: 'Antananarivo',
          commune: l.zone,
          fokontany: '',
          addressHint: 'Localisation indicative du scénario.',
          landmark: 'Repère à préciser',
          lat: l.coordinates[0],
          lng: l.coordinates[1],
          photos: l.gallery.map(photo),
          documents: l.documents.map((d: Row, n: number) => ({
            ...d,
            category: n === 1 ? 'Plan du terrain' : 'Autre document',
            number: '',
            issuedAt: '',
            ownerName: c.fullName,
            status: r.documentsStatus,
          })),
          salePayment:
            l.paymentMode === 'comptant'
              ? 'Comptant – paiement en une fois'
              : 'Les deux – comptant ou facilité',
          maxDuration: '10–12 mois',
          maxDurationOther: '',
          depositRange: '25–35 %',
          depositCustom: 0,
          frequency: 'Mensuelle',
          frequencyOther: '',
          saleNegotiable: 'Oui',
          negotiationMargin: 'À convenir',
          specialConditions: 'Hypothèses de présentation sans engagement.',
          ownerComments: p.message,
          agent: r.agent,
          receivedAt: at(r.receivedOffset).slice(0, 10),
          priority: r.priority,
          status: r.status,
          fieldCheck: r.fieldCheck,
          legalCheck: r.legalCheck,
          internalEstimate: l.price,
          recommendedPrice: l.price,
          commission: 5,
          internalComments: r.note,
          checklist: [
            'Coordonnées du propriétaire renseignées',
            'Pièces du dossier jointes',
            'Plan de situation joint',
            'Prix et conditions de vente saisis',
          ],
          visitAt: at(r.visitOffset ?? 0, '14:30'),
          notes: [entry(r.key + '-note', r.note, -1, r.agent)],
          tasks: [
            {
              id: 'task-' + r.key,
              due: at(r.followUpOffset).slice(0, 10),
              text: 'Faire le point sur les pièces et la prochaine étape.',
              done: false,
            },
          ],
          actions: [
            {
              id: 'action-' + r.key,
              type: 'Appel',
              at: at(r.followUpOffset, '15:00'),
              note: 'Suivi des pièces.',
              done: false,
            },
          ],
          history: [
            entry(
              r.key + '-received',
              'Dossier reçu et supports joints.',
              r.receivedOffset,
              r.agent,
            ),
          ],
        };
      });
      const messages = input.messages.map((r: Row, i: number) => {
        const p = people.get(r.clientKey)!;
        return {
          id: String(i + 1),
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
          email: p.email,
          subject: r.subject,
          message: r.body,
          status: r.read ? 'traité' : 'nouveau',
          createdAt: at(r.createdOffset),
        };
      });
      const realisations = input.projects.map((r: Row, i: number) => ({
        ...r,
        id: String(i + 1),
        createdAt: at(-20),
        updatedAt: at(-1),
        photos: r.photos.map(photo),
      }));
      realisations.push({
        id: '4',
        title: 'Projet à documenter',
        category: '',
        location: '',
        description: '',
        completedAt: '',
        client: '',
        area: 0,
        duration: '',
        photos: [],
        published: false,
        featured: false,
        createdAt: at(),
        updatedAt: at(),
      });
      // Cas partiel ajouté : tester un objet simple sans fabriquer de valeurs.
      clients.push({
        id: '13',
        ref: ref('CLI', 12),
        createdAt: at(),
        source: 'Backoffice',
        fullName: 'Lova — contact à qualifier',
        phone: '0340000013',
        email: '',
        budget: '',
        profession: '',
        age: '',
        nationality: '',
        bankAccount: '',
        message: '',
      });
      messages.push({
        id: '7',
        firstName: 'Lova',
        lastName: '',
        phone: '0340000013',
        email: '',
        subject: '',
        message: 'Merci de me rappeler pour préciser mon projet.',
        status: 'nouveau',
        createdAt: at(),
      });
      return {
        lands,
        clients,
        requests,
        searches,
        landFiles,
        messages,
        realisations,
        presentationAllowed: false,
      };
    };
    let data = seed();
    const resources: Record<string, keyof Dataset> = {
      lands: 'lands',
      clients: 'clients',
      requests: 'requests',
      searches: 'searches',
      'land-files': 'landFiles',
      messages: 'messages',
      realisations: 'realisations',
    };
    const json = (res: ServerResponse, status: number, value: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      const payload = Buffer.from(JSON.stringify(value));
      const gzip = String(res.req.headers['accept-encoding'] ?? '').split(',').some((entry) => {
        const [name, ...params] = entry.trim().split(';');
        const quality = params.find((p) => p.trim().startsWith('q='))?.trim().slice(2);
        return name.trim() === 'gzip' && (quality === undefined || Number(quality) > 0);
      });
      res.setHeader('Vary', 'Accept-Encoding');
      if (gzip && payload.length > 1024) {
        res.setHeader('Content-Encoding', 'gzip');
        res.end(gzipSync(payload));
      } else res.end(payload);
    };
    const body = async (req: IncomingMessage) => {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024)
          throw new Error('Fichier trop volumineux.');
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    };
    server.middlewares.use(async (req, res, next) => {
      const pathname = new URL(req.url ?? '/', 'http://preview.local')
        .pathname;
      if (
        pathname === '/' &&
        !new URL(req.url ?? '/', 'http://preview.local').searchParams.has(
          'site',
        )
      ) {
        res.statusCode = 302;
        res.setHeader('Location', '/admin');
        res.end();
        return;
      }
      if (!pathname.startsWith('/api/v1/')) return next();
      // Un iframe sandboxé peut avoir une origine opaque « null ». Le mock,
      // et lui seul, accepte ces appels ; aucune API Laravel n'est exposée.
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
      res.setHeader('Access-Control-Max-Age', '600');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      try {
        const path = pathname.slice('/api/v1'.length),
          method = req.method ?? 'GET';
        if (path === '/admin/login' && method === 'POST') {
          const credentials = JSON.parse((await body(req)).toString());
          if (
            credentials.email !== user.email ||
            credentials.password !== password
          )
            return json(res, 401, {
              message: 'Utilisez les identifiants de l’aperçu.',
            });
          const token = 'preview-' + randomUUID();
          sessions.add(token);
          return json(res, 200, { token, user });
        }
        const token = String(req.headers.authorization ?? '').replace(
          /^Bearer /,
          '',
        );
        if (path.startsWith('/admin/') && !sessions.has(token))
          return json(res, 401, { message: 'Connectez-vous à l’aperçu.' });
        if (path.startsWith('/preview/media/') && method === 'GET') {
          const f = attachments.get(
            decodeURIComponent(path.slice('/preview/media/'.length)),
          );
          if (!f?.public)
            return json(res, 404, {
              message: 'Visuel public introuvable dans l’aperçu.',
            });
          res.setHeader('Content-Type', f.type);
          res.setHeader('Content-Length', f.content.length);
          res.setHeader('Cache-Control', 'no-store');
          res.end(f.content);
          return;
        }
        if (path === '/admin/bootstrap') return json(res, 200, data);
        if (path === '/admin/logout') {
          sessions.delete(token);
          return json(res, 200, { message: 'Déconnecté.' });
        }
        if (path === '/admin/preview/reset' && method === 'POST') {
          data = seed();
          return json(res, 200, {
            message: 'Les données d’aperçu ont été restaurées.',
          });
        }
        if (path.startsWith('/admin/files/') && method === 'GET') {
          const f = attachments.get(
            decodeURIComponent(path.slice('/admin/files/'.length)),
          );
          if (!f)
            return json(res, 404, {
              message: 'Fichier d’aperçu introuvable.',
            });
          res.setHeader('Content-Type', f.type);
          res.setHeader('Content-Length', f.content.length);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader(
            'Content-Disposition',
            `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
          );
          res.end(f.content);
          return;
        }
        if (path === '/admin/uploads' && method === 'POST') {
          const raw = await body(req),
            publicMedia = /name="visibility"\r\n\r\npublic\r\n/.test(
              raw.toString(),
            ),
            boundary = String(req.headers['content-type'])
              .match(/boundary=(?:"([^"]+)"|([^;]+))/)
              ?.slice(1)
              .find(Boolean);
          if (!boundary)
            return json(res, 422, { message: 'Fichier manquant.' });
          const marker = Buffer.from('--' + boundary);
          let pos = 0;
          while ((pos = raw.indexOf(marker, pos)) >= 0) {
            const start = raw.indexOf(Buffer.from('\r\n\r\n'), pos);
            if (start < 0) break;
            const header = raw.subarray(pos, start).toString();
            const name = header.match(/filename="([^"]+)"/)?.[1];
            const end = raw.indexOf(marker, start + 4);
            if (name && end >= 0) {
              const content = raw.subarray(start + 4, end - 2);
              const type =
                header.match(/Content-Type: ([^\r\n]+)/i)?.[1] ??
                'application/octet-stream';
              const id = 'upload-' + randomUUID();
              attachments.set(id, {
                content,
                name: basename(name),
                type,
                public: publicMedia,
              });
              return json(res, 200, {
                id,
                name: basename(name),
                type,
                size: content.length,
                url:
                  (publicMedia
                    ? '/api/v1/preview/media/'
                    : '/api/v1/admin/files/') + id,
              });
            }
            pos = start + 4;
          }
          return json(res, 422, { message: 'Fichier manquant.' });
        }
        const match = path.match(/^\/admin\/([^/]+)(?:\/([^/]+))?$/);
        if (match && resources[match[1]]) {
          const key = resources[match[1]],
            rows = data[key] as Row[],
            id = match[2];
          if (method === 'GET')
            return json(
              res,
              200,
              id ? (rows.find((r) => r.id === id) ?? null) : rows,
            );
          if (method === 'DELETE') {
            data[key] = rows.filter((r) => r.id !== id) as never;
            return json(res, 200, { message: 'Supprimé dans l’aperçu.' });
          }
          if (method === 'POST' || method === 'PUT') {
            const payload = JSON.parse((await body(req)).toString() || '{}');
            const now = new Date().toISOString();
            const recordId =
              id ??
              String(Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1);
            const found = rows.find((r) => r.id === recordId);
            const prefixes: Record<string, string> = {
              clients: 'CLI',
              requests: payload.kind === 'visite' ? 'VIS' : 'ACH',
              searches: 'REC',
              'land-files': 'VEN',
            };
            const record = {
              ...found,
              ...payload,
              id: recordId,
              createdAt: found?.createdAt ?? now,
              updatedAt: now,
            };
            if (prefixes[match[1]])
              record.ref = found?.ref ?? ref(prefixes[match[1]], rows.length);
            data[key] = (
              found
                ? rows.map((r) => (r.id === recordId ? record : r))
                : [record, ...rows]
            ) as never;
            return json(res, 200, record);
          }
        }
        if (path === '/lands' || path.startsWith('/lands/')) {
          const visible: Row[] = data.lands
            .filter((l) => l.publicationStatus === 'publie')
            .map(({ sales, ...l }) => ({
              ...l,
              lots: l.lots.map(({ history, ...lot }: Row) => lot),
              documents: l.documents.map(({ url, ...d }: Row) => d),
            }));
          return json(res, 200, {
            data:
              path === '/lands'
                ? visible
                : (visible.find((l) => l.id === path.split('/').pop()) ??
                  null),
          });
        }
        if (path === '/realisations')
          return json(res, 200, {
            data: data.realisations
              .filter((r) => r.published)
              .map((r) => ({
                ...r,
                photos: r.photos.map((p: Row) => p.url),
              })),
          });
        return json(res, 404, {
          message: 'Route non disponible dans l’aperçu isolé.',
        });
      } catch (error) {
        json(res, 422, {
          message:
            error instanceof Error ? error.message : 'Requête invalide.',
        });
      }
    });

  };
  return {
    name: 'ca-immo-isolated-admin-preview',
    apply: 'serve',
    configureServer: configure,
    configurePreviewServer: configure,
  };
}
