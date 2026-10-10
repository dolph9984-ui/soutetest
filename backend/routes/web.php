<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::get('/', function () {
    return view('welcome');
});

/*
|--------------------------------------------------------------------------
| Fichiers publics uploadés (images catalogue, médias back office)
|--------------------------------------------------------------------------
| Sécurise l'accès en développement même si `php artisan storage:link`
| n'a pas encore été exécuté : la route sert le fichier depuis le disque
| `public`. En production, un vrai lien public /storage reste recommandé.
|
| Content-Disposition « inline » par défaut pour que les PDFs/images
| s'affichent dans le navigateur sans téléchargement intempestif.
*/
Route::get('/storage/{path}', function (Request $request, string $path) {
    abort_unless(Storage::disk('public')->exists($path), 404);

    $disk = Storage::disk('public');
    $mimeType = $disk->mimeType($path) ?: 'application/octet-stream';
    $size = $disk->size($path);
    $filename = basename($path);

    $disposition = $request->query('download') === '1'
        ? 'attachment'
        : 'inline';

    $stream = $disk->readStream($path);

    return response()->stream(function () use ($stream) {
        fpassthru($stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
    }, 200, [
        'Content-Type' => $mimeType,
        'Content-Length' => $size,
        'Content-Disposition' => $disposition . '; filename="' . $filename . '"',
        'X-Content-Type-Options' => 'nosniff',
    ]);
})->where('path', '.*');
