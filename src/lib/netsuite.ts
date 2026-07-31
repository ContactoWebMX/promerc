import crypto from "node:crypto";

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta configurar ${nombre} para la integración con NetSuite.`);
  }
  return valor;
}

// RFC 3986: encodeURIComponent no escapa !, *, ' ni (), pero OAuth 1.0a los
// requiere codificados — sin esto la firma HMAC no coincide con la que
// calcula NetSuite del lado del servidor.
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function firmarSolicitudTBA(method: string, url: string): string {
  const accountId = requerido("NETSUITE_ACCOUNT_ID");
  const consumerKey = requerido("NETSUITE_CONSUMER_KEY");
  const consumerSecret = requerido("NETSUITE_CONSUMER_SECRET");
  const tokenId = requerido("NETSUITE_TOKEN_ID");
  const tokenSecret = requerido("NETSUITE_TOKEN_SECRET");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: tokenId,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_version: "1.0",
  };

  const parametrosFirmados = Object.entries(oauthParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(parametrosFirmados),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(baseString)
    .digest("base64");

  const realm = accountId.toUpperCase().replace(/-/g, "_");
  const authParams = { ...oauthParams, oauth_signature: signature };

  return (
    `OAuth realm="${realm}", ` +
    Object.entries(authParams)
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ")
  );
}

async function postRecord(
  recordType: "purchaseorder" | "salesorder",
  body: Record<string, unknown>,
): Promise<{ id: string; tranId: string | null }> {
  const accountId = requerido("NETSUITE_ACCOUNT_ID");
  const createUrl = `https://${accountId}.suitetalk.api.netsuite.com/services/rest/record/v1/${recordType}`;

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: firmarSolicitudTBA("POST", createUrl),
      "Content-Type": "application/json",
      // El REST API de NetSuite exige estos headers con el idioma default de
      // la compañía (no el del usuario) — sin ellos rechaza la solicitud con
      // INVALID_HEADER, incluso en cuentas configuradas en español.
      // Content-Language describe el idioma del body que mandamos; Accept-
      // Language, el idioma en el que esperamos la respuesta — NetSuite pide
      // ambos por separado según el tipo de solicitud.
      "Content-Language": "en",
      "Accept-Language": "en",
    },
    body: JSON.stringify(body),
  });

  if (!createResponse.ok) {
    throw new Error(
      `NetSuite rechazó la orden (${createResponse.status}): ${await createResponse.text()}`,
    );
  }

  const location = createResponse.headers.get("Location");
  if (!location) {
    throw new Error("NetSuite no devolvió la ubicación de la orden creada.");
  }
  const id = location.split("/").pop();
  if (!id) {
    throw new Error("NetSuite no devolvió un ID válido para la orden creada.");
  }

  // La orden ya existe en NetSuite en este punto (el POST tuvo éxito) — si
  // la lectura de confirmación falla, no se debe perder el id: lanzar aquí
  // dejaría la orden creada en NetSuite sin registro en PROMERC, y un
  // reintento del usuario crearía una segunda orden duplicada.
  try {
    const getResponse = await fetch(location, {
      headers: {
        Authorization: firmarSolicitudTBA("GET", location),
        "Accept-Language": "en",
      },
    });
    if (!getResponse.ok) {
      console.error(
        `[netsuite] confirmación de orden ${id} falló (${getResponse.status}): ${await getResponse.text()}`,
      );
      return { id, tranId: null };
    }
    const record = (await getResponse.json()) as { tranId: string };
    return { id, tranId: record.tranId ?? null };
  } catch (error) {
    console.error(`[netsuite] confirmación de orden ${id} falló:`, error);
    return { id, tranId: null };
  }
}

export function construirPayloadOrdenCompra(input: {
  netsuiteVendorId: string;
  netsuiteItemId: string;
  netoKg: number;
  precioUnitarioKg: number;
  subsidiaryId: string;
  tranDate: string;
  employeeId: string;
  locationId: string;
  departmentId: string;
}) {
  return {
    entity: { id: input.netsuiteVendorId },
    subsidiary: { id: input.subsidiaryId },
    tranDate: input.tranDate,
    // "Fecha de cita" en el formulario de esta cuenta — mismo valor que
    // tranDate, no hay concepto de cita separado en el flujo de báscula.
    dueDate: input.tranDate,
    employee: { id: input.employeeId },
    location: { id: input.locationId },
    // "Centro de Aprobación" en el formulario — es el campo department.
    department: { id: input.departmentId },
    item: {
      items: [
        { item: { id: input.netsuiteItemId }, quantity: input.netoKg, rate: input.precioUnitarioKg },
      ],
    },
  };
}

export function construirPayloadOrdenVenta(input: {
  netsuiteCustomerId: string;
  netsuiteItemId: string;
  pesoKg: number;
  precioUnitarioKg: number;
  subsidiaryId: string;
  tranDate: string;
  employeeId: string;
  locationId: string;
  departmentId: string;
}) {
  return {
    entity: { id: input.netsuiteCustomerId },
    subsidiary: { id: input.subsidiaryId },
    tranDate: input.tranDate,
    dueDate: input.tranDate,
    employee: { id: input.employeeId },
    location: { id: input.locationId },
    department: { id: input.departmentId },
    item: {
      items: [
        { item: { id: input.netsuiteItemId }, quantity: input.pesoKg, rate: input.precioUnitarioKg },
      ],
    },
  };
}

export async function crearOrdenCompra(input: {
  netsuiteVendorId: string;
  netsuiteItemId: string;
  netoKg: number;
  precioUnitarioKg: number;
  tranDate: string;
  employeeId: string;
  locationId: string;
  departmentId: string;
}): Promise<{ id: string; tranId: string | null }> {
  const subsidiaryId = requerido("NETSUITE_SUBSIDIARY_ID");
  const payload = construirPayloadOrdenCompra({ ...input, subsidiaryId });
  return postRecord("purchaseorder", payload);
}

export async function crearOrdenVenta(input: {
  netsuiteCustomerId: string;
  netsuiteItemId: string;
  pesoKg: number;
  precioUnitarioKg: number;
  tranDate: string;
  employeeId: string;
  locationId: string;
  departmentId: string;
}): Promise<{ id: string; tranId: string | null }> {
  const subsidiaryId = requerido("NETSUITE_SUBSIDIARY_ID");
  const payload = construirPayloadOrdenVenta({ ...input, subsidiaryId });
  return postRecord("salesorder", payload);
}
