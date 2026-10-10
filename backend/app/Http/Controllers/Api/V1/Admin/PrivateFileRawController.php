<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Retourne le contenu d'un fichier CRM encodé en base64 dans un JSON.
 *
 * Pourquoi ? Internet Download Manager (IDM) intercepte TOUTES les requêtes
 * vers localhost qui retournent un PDF, même si le Content-Type est
 * application/octet-stream. En encapsulant le PDF dans du JSON, IDM ne voit
 * jamais de fichier téléchargeable et la requête passe normalement.
 *
 * Endpoint : GET /api/v1/admin/files-raw/{path}
 * Response : { "data": "<base64>", "type": "application/pdf", "size": 12345 }
 */
class PrivateFileRawController extends Controller
{
    public function show(Request $request, string $path): \Illuminate\Http\JsonResponse
    {
        $path = ltrim(rawurldecode($path), '/');

        abort_if(str_contains($path, '..'), 400, 'Chemin de fichier invalide.');
        abort_unless(Storage::disk('local')->exists($path), 404);

        $disk = Storage::disk('local');
        $content = $disk->get($path);

        if ($content === false || $content === null) {
            abort(500, 'Impossible de lire le fichier.');
        }

        return response()->json([
            'data' => base64_encode($content),
            'type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'size' => strlen($content),
        ]);
    }
}
