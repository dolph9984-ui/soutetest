<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Sert un fichier CRM confidentiel après autorisation Sanctum.
 *
 * ️ ANTI-IDM : on envoie Content-Type: application/octet-stream et pas de
 * Content-Disposition avec filename, car Internet Download Manager intercepte
 * les requêtes vers des URLs contenant .pdf ou .docx etc. et force le
 * téléchargement, ce qui vide le blob côté client. Le frontend détecte le
 * vrai type via la signature binaire du fichier, pas via les headers HTTP.
 *
 * Le fichier peut tout de même être téléchargé volontairement via le bouton
 * « Télécharger » du lecteur (qui utilise a.download en JS, pas IDM).
 */
class PrivateFileController extends Controller
{
    public function show(Request $request, string $path): \Symfony\Component\HttpFoundation\Response
    {
        $path = ltrim(rawurldecode($path), '/');

        abort_if(str_contains($path, '..'), 400, 'Chemin de fichier invalide.');
        abort_unless(Storage::disk('local')->exists($path), 404);

        $disk = Storage::disk('local');
        $content = $disk->get($path);

        if ($content === false || $content === null) {
            abort(500, 'Impossible de lire le fichier.');
        }

        $size = strlen($content);

        // Force téléchargement si demandé explicitement via ?download=1.
        if ($request->query('download') === '1') {
            $filename = basename($path);
            return response($content, 200, [
                'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
                'Content-Length' => $size,
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Cache-Control' => 'private, no-store, max-age=0',
            ]);
        }

        // Mode aperçu : on cache volontairement le type réel et le nom de
        // fichier pour éviter qu'IDM (ou un navigateur zélé) ne force le
        // téléchargement. Le frontend détecte le PDF via sa signature
        // binaire (%PDF-), pas via les headers HTTP.
        return response($content, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => $size,
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
            'Accept-Ranges' => 'bytes',
        ]);
    }
}
