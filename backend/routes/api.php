<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Public as PublicApi;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API CA IMMO — /api/v1
|--------------------------------------------------------------------------
| Site public : lectures (catalogue, réalisations) + demandes (achat, visite,
| recherche, vente). Back office : ressources protégées par Sanctum
| (connexion sur /api/v1/admin/login, ability « admin »).
*/

Route::prefix('v1')->group(function () {

    /* ---------- Site public ---------- */
    Route::get('/lands', [PublicApi\LandController::class, 'index']);
    Route::get('/lands/{id}', [PublicApi\LandController::class, 'show']);
    Route::get('/realisations', [PublicApi\RealisationController::class, 'index']);
    Route::post('/requests', [PublicApi\RequestController::class, 'store'])->middleware(['throttle:12,1', 'atomic']);
    Route::post('/searches', [PublicApi\SearchController::class, 'store'])->middleware(['throttle:12,1', 'atomic']);
    Route::post('/land-files', [PublicApi\LandFileController::class, 'store'])->middleware(['throttle:12,1', 'atomic']);
    Route::post('/messages', [PublicApi\MessageController::class, 'store'])->middleware(['throttle:12,1', 'atomic']);

    /* ---------- Back office ---------- */
    Route::prefix('admin')->name('admin.')->group(function () {
        Route::post('/login', [Admin\AuthController::class, 'login'])->middleware('throttle:6,1');

        Route::middleware(['auth:sanctum', 'abilities:admin'])->group(function () {
            Route::get('/me', [Admin\AuthController::class, 'me']);
            Route::get('/files/{path}', [Admin\PrivateFileController::class, 'show'])->where('path', '.*');
            // Endpoint base64 pour les fichiers : encapsulé dans du JSON pour
            // contourner IDM (Internet Download Manager) qui intercepte toutes
            // les réponses PDF directes, même avec Content-Type octet-stream.
            Route::get('/files-raw/{path}', [Admin\PrivateFileRawController::class, 'show'])->where('path', '.*');
            Route::post('/logout', [Admin\AuthController::class, 'logout']);
            Route::get('/stats', [Admin\StatsController::class, 'index']);
            Route::get('/bootstrap', [Admin\BootstrapController::class, 'index']);

            Route::post('/uploads', [Admin\UploadController::class, 'store']);
            Route::post('/lands/reset', [Admin\LandController::class, 'reset']);

            Route::apiResource('searches', Admin\SearchController::class);
            Route::apiResource('land-files', Admin\LandFileController::class);

            Route::get('/requests', [Admin\RequestController::class, 'index']);
            Route::post('/requests', [Admin\RequestController::class, 'store']);
            Route::get('/requests/{id}', [Admin\RequestController::class, 'show']);
            Route::match(['put', 'patch'], '/requests/{id}', [Admin\RequestController::class, 'update']);
            Route::delete('/requests/{id}', [Admin\RequestController::class, 'destroy']);

            Route::get('/clients', [Admin\ClientController::class, 'index']);
            Route::post('/clients', [Admin\ClientController::class, 'store']);
            Route::get('/clients/{id}', [Admin\ClientController::class, 'show']);
            Route::match(['put', 'patch'], '/clients/{id}', [Admin\ClientController::class, 'update']);
            Route::delete('/clients/{id}', [Admin\ClientController::class, 'destroy']);

            Route::get('/messages', [Admin\MessageController::class, 'index']);
            Route::match(['put', 'patch'], '/messages/{id}', [Admin\MessageController::class, 'update']);
            Route::delete('/messages/{id}', [Admin\MessageController::class, 'destroy']);

            Route::apiResource('lands', Admin\LandController::class);
            Route::apiResource('realisations', Admin\RealisationController::class);
        });
    });
});
